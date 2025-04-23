import https from "https";
import http from "http";
import { retry } from "async";
import pjson from "../package.json" with { type: "json" };
import memory from "./memory.js";
import * as url from "node:url";
import logger from "./logger.js";

const attemptCall = async (addr) => {
  return new Promise((resolve, reject) => {
    const api = url.parse(memory.db.api);
    const options = {
      headers: {
        Origin: `${api.protocol}//${api.hostname}${api.port ? `:${api.port}` : ''}`,
        "User-Agent": `Bitwatch/${pjson.version}`,
        Accept: "application/json, text/plain, */*",
        "Accept-Language": "en-US,en;q=0.9",
        "Content-Type": "application/json;charset=UTF-8",
        "Content-Length": 0,
        Connection: "keep-alive",
      },
      method: "GET",
      host: api.hostname,
      port: api.port || (api.protocol === "https:" ? 443 : 80),
      path: '/api/address',
    };

    const currentOpt = { ...options };
    currentOpt.path = `${options.path}/${addr}`;
    
    // Build curl command for logging
    // const headers = Object.entries(currentOpt.headers)
    //   .map(([key, value]) => `-H '${key}: ${value}'`)
    //   .join(' ');
    const fullUrl = `${api.protocol}//${api.hostname}${api.port ? `:${api.port}` : ''}${currentOpt.path}`;
    logger.network(`Fetching balance for ${addr}:\ncurl '${fullUrl}'`);
    
    const req = (api.protocol === "https:" ? https : http).request(
      currentOpt,
      function (res) {
        const { statusCode } = res;
        res.setEncoding("utf8");
        let body = "";
        res.on("data", function (d) {
          body += d;
        });
        res.on("end", function () {
          if (statusCode !== 200) {
            logger.error(`API error for ${addr}: ${statusCode} ${body}`);
            return reject({ error: true, message: `API error: ${statusCode} ${body}` });
          }
          try {
            const json = JSON.parse(body);
            json.actual = {
              chain_in: json.chain_stats.funded_txo_sum||0,
              chain_out: json.chain_stats.spent_txo_sum||0,
              mempool_in: json.mempool_stats.funded_txo_sum || 0,
              mempool_out: json.mempool_stats.spent_txo_sum || 0,
            };
            logger.success(`Balance ${addr}: chain (in=${json.actual.chain_in}, out=${json.actual.chain_out}), mempool (in=${json.actual.mempool_in}, out=${json.actual.mempool_out})`);
            resolve(json);
          } catch (error) {
            logger.error(`JSON parse error for ${addr}: ${error.message}`);
            reject({ error: true, message: `JSON parse error: ${error.message}` });
          }
        });
      }
    );
    req.on("error", (e) => {
      if(e.statusCode === 504) {
        logger.warning(`Server capacity exceeded for ${addr} - address will be ignored`);
        reject({ error: true, message: "Server capacity exceeded" });
      } else {
        logger.error(`Network error for ${addr}: ${e.message}`);
        reject({ error: true, message: `Network error: ${e.message}` });
      }
    });

    req.end();
  });
};

const getAddressBalance = async (addr, onRateLimit) => {
  let retryCount = 0;
  const maxRetries = 5;
  const baseDelay = 2000; // Start with 2 seconds

  while (retryCount < maxRetries) {
    try {
      const result = await attemptCall(addr);
      return result;
    } catch (error) {
      // Check if it's a rate limit error
      if (error.message?.includes('429') || error.message?.includes('Too Many Requests')) {
        retryCount++;
        if (retryCount === maxRetries) {
          logger.error(`Rate limit exceeded for ${addr} after ${maxRetries} retries`);
          return { error: true, message: "Rate limit exceeded. Please try again later." };
        }
        
        // Calculate exponential backoff delay
        const delay = baseDelay * Math.pow(2, retryCount - 1);
        logger.warning(`Rate limited for ${addr}, retrying in ${delay}ms (attempt ${retryCount}/${maxRetries})`);

        // Notify about rate limit through callback if provided
        if (onRateLimit) {
          onRateLimit(delay, retryCount, maxRetries);
        }

        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      // For other errors, return immediately
      logger.error(`Failed to fetch balance for ${addr}: ${error.message}`);
      return { error: true, message: error.message };
    }
  }
  
  return { error: true, message: "Max retries exceeded" };
};

export default getAddressBalance;

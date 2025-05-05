import https from "https";
import http from "http";
import { retry } from "async";
import pjson from "../package.json" with { type: "json" };
import memory from "./memory.js";
import * as url from "node:url";
import logger from "./logger.js";
import socketIO from "./io.js";

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
    
    const fullUrl = `${api.protocol}//${api.hostname}${api.port ? `:${api.port}` : ''}${currentOpt.path}`;
    // logger.network(`Fetching balance: ${fullUrl}`);
    
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
            reject({ error: true, message: `API error: ${statusCode} ${body}` });
            return;
          }

          const json = JSON.parse(body);
          if (!json) {
            logger.error(`Failed to parse JSON response for ${addr}`);
            reject({ error: true, message: "Invalid JSON response" });
            return;
          }

          const result = {
            actual: {
              chain_in: json.chain_stats?.funded_txo_sum || 0,
              chain_out: json.chain_stats?.spent_txo_sum || 0,
              mempool_in: json.mempool_stats?.funded_txo_sum || 0,
              mempool_out: json.mempool_stats?.spent_txo_sum || 0,
            }
          };

          logger.success(`Balance ${addr}: chain (in=${result.actual.chain_in}, out=${result.actual.chain_out}), mempool (in=${result.actual.mempool_in}, out=${result.actual.mempool_out})`);
          resolve(result);
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
    const result = await attemptCall(addr).catch((e) => {
      return { error: true, message: e.message };
    });
    if (!result.error) {
      // If we got here after retries, notify that API is good again
      if (retryCount > 0) {
        socketIO.io.emit("updateState", { 
          collections: memory.db.collections,
          apiState: "GOOD"
        });
      }
      return result;
    }

    // Check if it's a rate limit error
    if (result.message?.includes('429') || result.message?.includes('Too Many Requests')) {
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
    logger.error(`Failed to fetch balance for ${addr}: ${result.message}`);
    return { error: true, message: result.message };
  }
  
  return { error: true, message: "Max retries exceeded" };
};

export default getAddressBalance;

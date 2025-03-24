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
        Origin: `${api.protocol}//${api.hostname}`,
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
    logger.network(`Fetching balance for ${addr}`);
    
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
            // Subtract mempool values from chain values to get true confirmed balances
            json.actual = {
              chain_in: json.chain_stats.funded_txo_sum||0,
              chain_out: json.chain_stats.spent_txo_sum||0,
              mempool_in: json.mempool_stats.funded_txo_sum || 0,
              mempool_out: json.mempool_stats.spent_txo_sum || 0,
            };
            logger.success(`Balance fetched for ${addr}: chain_in=${json.actual.chain_in}, chain_out=${json.actual.chain_out}, mempool_in=${json.actual.mempool_in}, mempool_out=${json.actual.mempool_out}`);
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

const getAddressBalance = async (addr) => {
  try {
    return await retry(
      {
        times: 3,
        interval: function (retryCount) {
          return 50 * Math.pow(2, retryCount);
        },
      },
      async () => attemptCall(addr)
    );
  } catch (error) {
    logger.error(`Failed to fetch balance for ${addr}: ${error.message}`);
    return { error: true, message: error.message };
  }
};
export default getAddressBalance;

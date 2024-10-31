import Client, {
    CommitmentLevel,
    SubscribeRequestAccountsDataSlice,
    SubscribeRequestFilterAccounts,
    SubscribeRequestFilterBlocks,
    SubscribeRequestFilterBlocksMeta,
    SubscribeRequestFilterEntry,
    SubscribeRequestFilterSlots,
    SubscribeRequestFilterTransactions,
} from "@triton-one/yellowstone-grpc";
import { SubscribeRequestPing } from "@triton-one/yellowstone-grpc/dist/grpc/geyser";
import { tOutPut } from "./utils/transactionOutput";
import 
    web3, {
        clusterApiUrl,
    ComputeBudgetProgram,
    Connection,
    Keypair,
    LAMPORTS_PER_SOL,
    PublicKey,
    SystemProgram,
    Transaction,
    TransactionInstruction,
    TransactionMessage,
    VersionedTransaction,
} from "@solana/web3.js";
import {
    getAssociatedTokenAddress,
    createAssociatedTokenAccountInstruction,
    TOKEN_PROGRAM_ID,
    createAssociatedTokenAccountIdempotentInstruction,
    getMint,
    getAssociatedTokenAddressSync,
    ASSOCIATED_TOKEN_PROGRAM_ID,
    createSyncNativeInstruction,
} from "@solana/spl-token";
import TelegramBot from "node-telegram-bot-api";
import {
    bufferFromUInt64,
    checkIfBaseFn,
    createPoolKeys,
    decodePumpEvent,
    decodePumpEventPayer,
    decodeRayLogFn,
    DEFAULT_TOKEN,
    formatAmmKeysById,
    getRandomValidator,
    MINIMAL_MARKET_STATE_LAYOUT_V3,
    MinimalMarketLayoutV3,
    read_biguint_le,
    sleep,
} from "./utils/utils";
import dotenv from "dotenv";
import winston from "winston";
import {
    CurrencyAmount,
    Liquidity,
    LIQUIDITY_STATE_LAYOUT_V4,
    LiquidityStateV4,
    MAINNET_PROGRAM_ID,
    Market,
    MARKET_STATE_LAYOUT_V3,
    Percent,
    SPL_MINT_LAYOUT,
    Token,
    TokenAmount,
} from '@raydium-io/raydium-sdk';
import { SolanaParser } from "@shyft-to/solana-transaction-parser";
import RaydiumAmmParser from "./utils/decodeRaydiumInstruction";
import TransactionFormatter from "./utils/transaction-formatter";
import { derivePoolKeys } from "./utils/derivePoolkeys";
import { BN } from "@project-serum/anchor";
import { at } from "lodash";
import {SearcherServiceClient} from "jito-ts/dist/gen/block-engine/searcher";
import {SearcherClient} from "jito-ts/dist/sdk/block-engine/searcher";
import { Bundle } from 'jito-ts/dist/sdk/block-engine/types';
import {ChannelCredentials, ChannelOptions} from "@grpc/grpc-js";


const searcherClient = (
    url: string,
    grpcOptions?: Partial<ChannelOptions>
): SearcherClient => {
    return new SearcherClient(new SearcherServiceClient(
        url,
        ChannelCredentials.createSsl(),
        grpcOptions
    ));
};

const jito_client = searcherClient('ny.mainnet.block-engine.jito.wtf');
const jitoFeeSellLamports = 10000000 // 0.01


/* 
 
For full code: tg @mayneman

*/

dotenv.config();

const GRPC_ENDPOINT =
    process.env.GRPC_ENDPOINT || "";
const RPC =
    process.env.RPC ||
    "";

let PRIVATE_KEY_ARRAY: number[] = [];
if (process.env.PRIVATE_KEY) {
    try {
        PRIVATE_KEY_ARRAY = JSON.parse(process.env.PRIVATE_KEY);
        if (!Array.isArray(PRIVATE_KEY_ARRAY)) {
            throw new Error("PRIVATE_KEY is not a valid array");
        }
    } catch (error) {
        throw new Error(
            `Invalid PRIVATE_KEY format. Ensure it's a JSON array of numbers. Error: ${error}`
        );
    }
} else {
    throw new Error("PRIVATE_KEY not set in environment variables");
}

const COPY_PERCENT = Number(process.env.COPY_PERCENT);
const SLIPPAGE = Number(process.env.SLIPPAGE);
const SLIPPAGE_RAY = Number(process.env.SLIPPAGE_RAY);
const SLIPPAGE_SELL = Number(process.env.SLIPPAGE_SELL);
const SOL_BUY_LIMIT = Number(process.env.SOL_BUY_LIMIT);
const PRIORITY_FEES_PUMP = BigInt(process.env.PRIORITY_FEES_PUMP);
const PRIORITY_LIMIT_PUMP = Number(process.env.PRIORITY_LIMIT_PUMP);
const PRIORITY_FEES_RAY = BigInt(process.env.PRIORITY_FEES_RAY);
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const TELEGRAM_USER_ID = process.env.TELEGRAM_USER_ID
    ? Number(process.env.TELEGRAM_USER_ID)
    : 0;
const TRY_ATTEMPTS = Number(process.env.TRY_ATTEMPTS);

// Wallet Addresses to Subscribe
const walletAddresses = [
    'DfMxre4cKmvogbLrPigxmibVTTQDuzjdXojWzjCXXhzj', // utils decodePumpEvent line 40 || last -2 instead of -1
];

const GLOBAL = new PublicKey("4wTV1YmiEkRvAtNtsSGPtUrqRYQMe5SKy2uB4Jjaxnjf");
const FEE_RECIPIENT = new PublicKey(
    "CebN5WGQ4jvEPvsVU4EoHEpgzq1VV7AbicfhtW4xC9iM"
);
const RENT = new PublicKey("SysvarRent111111111111111111111111111111111");
const PUMP_FUN_PROGRAM = new PublicKey("6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P");
const PUMP_FUN_ACCOUNT = new PublicKey(
    "Ce6TQqeHC9p8KetsN6JsjHK7UTZk7nasjjnr7XxXp9F1"
);
const SYSTEM_PROGRAM_ID = SystemProgram.programId;
const ASSOC_TOKEN_ACC_PROG = new PublicKey(
    "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
);

const CURVE_STATE_OFFSETS = {
    VIRTUAL_TOKEN_RESERVES: 0x08,
    VIRTUAL_SOL_RESERVES: 0x10,
    REAL_TOKEN_RESERVES: 0x18,
    REAL_SOL_RESERVES: 0x20,
    TOKEN_TOTAL_SUPPLY: 0x28,
    COMPLETE: 0x30,
};

const connection = new Connection(RPC, "processed");
const client = new Client(GRPC_ENDPOINT, undefined, undefined);
const bot =
    TELEGRAM_BOT_TOKEN !== ""
        ? new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: false })
        : null;

const PAYER = Keypair.fromSecretKey(new Uint8Array(PRIVATE_KEY_ARRAY));

const logger = winston.createLogger({
    level: "info",
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(
            ({ timestamp, level, message }) => `${timestamp} [${level.toUpperCase()}]: ${message}`
        )
    ),
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: "copy-trade.log" }),
    ],
});

/* 
 
For full code: tg @mayneman

*/

async function pumpFunSell(
    mint: PublicKey,
    BONDING_CURVE: PublicKey,
    ASSOCIATED_BONDING_CURVE: PublicKey,
    tokenAccountAddress: PublicKey,
    tokenIn: bigint
): Promise<string | void> {
    const maxRetries = 3;
    const retryDelay = 100;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const accInfo = await connection.getAccountInfo(BONDING_CURVE, "processed");
            if (!accInfo) throw new Error("Invalid Bonding Curve account information.");

            /* 

            For full code: tg @mayneman

            */

            const data = Buffer.concat([
                bufferFromUInt64("12502976635542562355"),
                bufferFromUInt64(tokenIn.toString()),
                bufferFromUInt64(minSolOutFixed.toString()),
            ]);

            const instruction = new TransactionInstruction({
                keys,
                programId: PUMP_FUN_PROGRAM,
                data,
            });

            const messageV0 = new TransactionMessage({
                payerKey: PAYER.publicKey,
                recentBlockhash: latestBlockHashSell,
                instructions: [
                    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: PRIORITY_FEES_PUMP }),
                    ComputeBudgetProgram.setComputeUnitLimit({ units: PRIORITY_LIMIT_PUMP }),
                    instruction,
                ],
            }).compileToV0Message();

            const transaction = new VersionedTransaction(messageV0);
            transaction.sign([PAYER]);

            /* 

            For full code: tg @mayneman

            */

            
            let bundle_hash = await jito_client.sendBundle(bundle);
            logger.info(bundle_hash)
            const txHash = await connection.sendRawTransaction(transaction.serialize(), {
                skipPreflight: true,
            });
            

            logger.info(`Sell transaction sent: ${txHash}`);
            return txHash;
        } catch (error) {
            logger.error(`Error during sell attempt ${attempt}: ${error}`);
            if (attempt < maxRetries) {
                logger.info(`Retrying sell in ${retryDelay / 1000} seconds...`);
                await sleep(retryDelay);
            }
        }
    }
    logger.error("Max retries reached. Sell swap unsuccessful.");
}

async function pumpFunBuy(
    mint: PublicKey,
    BONDING_CURVE: PublicKey,
    ASSOCIATED_BONDING_CURVE: PublicKey,
    tokenData: { virtual_token_reserves: bigint; virtual_sol_reserves: bigint },
    tokenAccountAddress: PublicKey,
    latestBlockHash: string,
    buySolPercent: number,
    startTime: number,
    accountInfo: web3.AccountInfo<Buffer>
): Promise<string | void> {
    try {
        const owner = PAYER.publicKey;
        const instructions: TransactionInstruction[] = [];

        /* 

        For full code: tg @mayneman

        */

        const data = Buffer.concat([
            bufferFromUInt64("16927863322537952870"),
            bufferFromUInt64(tokenOutFixed.toString()),
            bufferFromUInt64(maxSolCost.toString()),
        ]);

        const instruction = new TransactionInstruction({
            keys,
            programId: PUMP_FUN_PROGRAM,
            data,
        });

        instructions.push(instruction);

        const messageV0 = new TransactionMessage({
            payerKey: PAYER.publicKey,
            recentBlockhash: latestBlockHash,
            instructions: [
                ComputeBudgetProgram.setComputeUnitPrice({ microLamports: PRIORITY_FEES_PUMP }),
                ComputeBudgetProgram.setComputeUnitLimit({ units: PRIORITY_LIMIT_PUMP }),
                ...instructions,
            ],
        }).compileToV0Message();

        /* 

        For full code: tg @mayneman

        */

        const elapsedTime = Date.now() - startTime;
        logger.info(`Time before send transaction ${elapsedTime}ms`);

        let bundle_hash = await jito_client.sendBundle(bundle);
        logger.info(bundle_hash)
        const txHash = await connection.sendRawTransaction(transaction.serialize(), {
            skipPreflight: true,
        });
        const elapsedTimeAfterTx = Date.now() - startTime;
        logger.info(`Time after send transaction ${elapsedTimeAfterTx}ms`);
        logger.info(`Buy transaction sent: ${txHash}`);
        return txHash;
    } catch (error) {
        logger.error(`Error during PumpFun buy: ${error}`);
    }
}

async function raydiumSell(
    poolKeys: any,
    startTime: number,
    baseTokenAssociatedAddress: PublicKey,
    quoteTokenAssociatedAddress: PublicKey,
    mint: PublicKey,
    inputToken: any,
    outputToken: any,
    inputTokenAmount: any,
    slippage: any,
) {
    try {
        const poolInfo = await Liquidity.fetchInfo({ connection, poolKeys });

        /* 
 
        For full code: tg @mayneman

        */
    
        const inputTokenAccount = await connection.getAccountInfo(quoteTokenAssociatedAddress);
        if (!inputTokenAccount) {
            instructions.push(
                createAssociatedTokenAccountIdempotentInstruction(
                    PAYER.publicKey,
                    quoteTokenAssociatedAddress,
                    PAYER.publicKey,
                    inputTokenAmount.token.mint
                )
            );
        }

        /* 

        For full code: tg @mayneman

        */
    
        const latestBlockhash = await connection.getLatestBlockhash();
        const messageV0 = new TransactionMessage({
            payerKey: PAYER.publicKey,
            recentBlockhash: latestBlockhash.blockhash,
            instructions,
        }).compileToV0Message();

        /* 

        For full code: tg @mayneman

        */
        const endTime = Date.now();
        const elapsedTime = endTime - startTime;
        logger.info(`Time: ${elapsedTime}ms || TxHash: ${txHash}`);
        return txHash;
    } catch (error) {
        logger.error(`Error during Raydium buy: ${error}`);
        throw error;
    }
}

async function raydiumBuy(
    poolKeys: any,
    startTime: number,
    adjustedBuySolPercent: number,
    baseTokenAssociatedAddress: PublicKey,
    quoteTokenAssociatedAddress: PublicKey,
    mint: PublicKey,
    inputToken: any,
    outputToken: any,
    inputTokenAmount: any,
    slippage: any,
) {
    try {
        const poolInfo = await Liquidity.fetchInfo({ connection, poolKeys });

        /* 
 
        For full code: tg @mayneman

        */
    
        const outputTokenAccount = await connection.getAccountInfo(baseTokenAssociatedAddress);
        if (!outputTokenAccount) {
            instructions.push(
                createAssociatedTokenAccountIdempotentInstruction(
                    PAYER.publicKey,
                    baseTokenAssociatedAddress,
                    PAYER.publicKey,
                    outputToken.mint
                )
            );
        }

        if (!inputTokenAccount) {
            instructions.push(
                SystemProgram.transfer({
                    fromPubkey: PAYER.publicKey,
                    toPubkey: quoteTokenAssociatedAddress,
                    lamports: inputTokenAmount.raw,
                }),
                createSyncNativeInstruction(quoteTokenAssociatedAddress)
            );
        /* 
 
        For full code: tg @mayneman

        */
        const endTime = Date.now();
        const elapsedTime = endTime - startTime;
        logger.info(`Time: ${elapsedTime}ms || TxHash: ${txHash}`);
        return txHash;
    } catch (error) {
        logger.error(`Error during Raydium buy: ${error}`);
        throw error;
    }
}

function getPoolKeys(id: PublicKey, info: any, marketInfo: any, marketInfo_minimal: any) {
    /* 
    
    For full code: tg @mayneman

    */
}

async function processRayTx(txn: any, startTime: number) {
    let pumpfun = false;
    const parsedIxs = JSON.parse(JSON.stringify(IX_PARSER.parseTransactionWithInnerInstructions(txn), null, 2));
    const txHash = txn.transaction.signatures[0];
    for (let i = 0; i < parsedIxs.length; i++) {
        if (parsedIxs[i]?.name === 'swapBaseIn') {
            let attempt = 0;
            while (attempt < TRY_ATTEMPTS) {
                try {
                    if (parsedIxs[i + 1] === undefined) {
                        return;
                    }
                    /* 
 
                    For full code: tg @mayneman

                    */
        
                    const [ammIdData, marketAccount_minimal, marketAccount] = await Promise.all([
                        connection.getAccountInfo(amm, "processed"),
                        connection.getAccountInfo(marketId, {
                            commitment: "processed",
                            dataSlice: {
                                offset: MARKET_STATE_LAYOUT_V3.offsetOf("eventQueue"),
                                length: 32 * 3,
                            },
                        }),
                        connection.getAccountInfo(marketId, "processed")
                    ]);

                    /* 
 
                    For full code: tg @mayneman

                    */
                    if (poolState.baseMint.toBase58() === 'So11111111111111111111111111111111111111112') pumpfun = true;
                    if (parsedIxs[i + 1].accounts[1].pubkey === poolPcTokenAccount.toBase58() && pumpfun === false) {
                        /* 
 
                        For full code: tg @mayneman

                        */
                        logger.info(`BUY || TIME: ${Date.now() - startTime}ms || Sol: ${solAmountWithDecimals} || %: ${buySolPercent} Sol || Mint: ${mint.toBase58()} || TxHash: ${txHash}`);
                        const buyTxHash = await raydiumBuy(
                            poolKeys,
                            startTime,
                            adjustedBuySolPercentSol,
                            baseATA,
                            quoteATA,
                            mint,
                            inputToken,
                            outputToken,
                            inputTokenAmount,
                            slippageSet,
                        );
                        if (buyTxHash) {
                            if (processDataRay[mint.toBase58()] !== undefined) {
                                const entry = processDataRay[mint.toBase58()];
                                entry.donorSolAmount = (entry.donorSolAmount || 0) + Number(solAmountIn) / Number(LAMPORTS_PER_SOL);
                                entry.donorTokenAmount = (entry.donorTokenAmount || 0) + Number(tokensOut) / Math.pow(10, poolState.baseDecimal);
                                if (entry.donorTxHashes) {
                                    entry.donorTxHashes.push(txHash);
                                } else {
                                    entry.donorTxHashes = [txHash];
                                }
                            } else {
                                processDataRay[mint.toBase58()] = {
                                    ...(processDataRay[mint.toBase58()] || {}),
                                    donor: accounts[0],
                                    donorSolAmount: Number(solAmountIn) / Number(LAMPORTS_PER_SOL),
                                    donorTokenAmount: Number(tokensOut) / Math.pow(10, poolState.baseDecimal),
                                    donorTxHashes: [txHash],
                                };
                            }
                        }
                    }
                    if (parsedIxs[i + 1].accounts[1].pubkey === poolCoinTokenAccount.toBase58() && pumpfun === true) {
                            /* 
                        
                            For full code: tg @mayneman

                            */
                            if (payerTokenAmount > 0) {
                                const payerSellAmount = BigInt(Math.floor(payerTokenAmount * sellPercentage * Math.pow(10, poolState.quoteDecimal)));
                                const inputToken = new Token(TOKEN_PROGRAM_ID, mint, Number(poolState.quoteDecimal))
                                const outputToken =  DEFAULT_TOKEN.WSOL
                                const inputTokenAmount = new TokenAmount(
                                    inputToken,
                                    new BN(payerSellAmount)
                                );
                                const slippageSet = new Percent(SLIPPAGE_RAY, 100);
                                const sellTxHash = await raydiumSell(
                                    poolKeys,
                                    startTime,
                                    baseATA,
                                    quoteATA,
                                    mint,
                                    inputToken,
                                    outputToken,
                                    inputTokenAmount,
                                    slippageSet,
                                );
                                if (sellTxHash) {
                                    logger.info(`Executed sell for payer on token ${mint.toBase58()}: ${sellTxHash}`);
                                    const entry = processDataRay[mint.toBase58()];
                                    entry.donorSolAmount = (entry.donorSolAmount || 0) - Number(solAmountIn) / Number(LAMPORTS_PER_SOL);
                                    entry.donorTokenAmount = (entry.donorTokenAmount || 0) - sellTokenAmount;
                                    if (entry.donorTxHashes) {
                                        entry.donorTxHashes.push(txHash);
                                    } else {
                                        entry.donorTxHashes = [txHash];
                                    }
                                }
                            } else {
                                logger.warn(`Payer has no tokens to sell for ${mint.toBase58()}`);
                            }
                        } else {
                            logger.warn(`No buy process found for sell transaction of token ${mint.toBase58()}`);
                        }
                    }
                    break;
                } catch (error) {
                    logger.error(`Error during Raydium buy: ${error}`);
                    attempt++;
                }
            }
        }
    }
}

async function processTxPump(decodedData: any) {
    if (decodedData.meta.logMessages.some((log: string) => log.includes("Program log: Instruction: Buy"))) {
        const startTime = Date.now();
        const decodedEvent = await decodePumpEvent(decodedData);
        const mintBase58 = decodedEvent.pumpEventData.mint.toBase58();

        let buySolPercent = (decodedEvent.pumpEventData.solAmount / Number(LAMPORTS_PER_SOL)) * (COPY_PERCENT / 1000);

        if (buySolPercent > SOL_BUY_LIMIT) {
            logger.warn(`Buy percentage ${buySolPercent} exceeds SOL_BUY_LIMIT. Capping to limit.`);
            buySolPercent = SOL_BUY_LIMIT;
        }

        const adjustedBuySolPercent = Math.min(buySolPercent, SOL_BUY_LIMIT);

        const tokenAccountAddress = await getAssociatedTokenAddress(
            decodedEvent.pumpEventData.mint,
            PAYER.publicKey,
            false
        );
        /* 

        For full code: tg @mayneman

        */

        const buyTxHash = await pumpFunBuy(
            decodedEvent.pumpEventData.mint,
            decodedEvent.bondingCurve,
            decodedEvent.associatedBondingCurve,
            {
                virtual_token_reserves: tokenData.virtual_token_reserves,
                virtual_sol_reserves: tokenData.virtual_sol_reserves,
            },
            tokenAccountAddress,
            decodedEvent.latestBlockhash,
            adjustedBuySolPercent,
            startTime,
            accountInfo
        );

        if (buyTxHash) {
            logger.info(`Executed buy for token ${mintBase58}: ${buyTxHash}`);
            /* 

            For full code: tg @mayneman

            */
        }
    }

    if (
        decodedData.meta.logMessages.some((log: string) => log.includes("Program log: Instruction: Sell"))) {
        const decodedEvent = await decodePumpEvent(decodedData);
        const mintBase58 = decodedEvent.pumpEventData.mint.toBase58();

        if (processDataRay[mintBase58] !== undefined) {
            /* 

            For full code: tg @mayneman

            */
            logger.info(`Donor is selling ${(sellPercentage * 100).toFixed(2)}% of their tokens for ${mintBase58}`);

            const payerTokenAmount = processDataRay[mintBase58].payerTokenAmount || 0;

            if (payerTokenAmount > 0) {
                /* 

                For full code: tg @mayneman

                */
            } else {
                logger.warn(`Payer has no tokens to sell for ${mintBase58}`);
            }
        } else {
            logger.warn(
                `No buy process found for sell transaction of token ${mintBase58}`
            );
        }
    }
}

async function processRayTxPayer(txn: any, startTime: number) {
    /* 
    
    For full code: tg @mayneman

    */
}

async function processPumpTxPayer(decodedData: any) {
    /* 
 
    For full code: tg @mayneman
    
    */
}

async function processIncomingData(data: any) {
    if (data.filters && data.filters.length > 0) {
        const filterType = data.filters[0];
        if (filterType === "pump") {
            const decodedData = tOutPut(data);
            await processTxPump(decodedData);
        } 
        if (filterType === "payerAddressPump") {
            const decodedData = tOutPut(data);
            await processPumpTxPayer(decodedData);
        } 
        if (filterType === 'raydium') {
            if (data?.transaction) {
                const startTime = Date.now();
                const txn = TXN_FORMATTER.formTransactionFromJson(
                    data.transaction,
                    startTime,
                );
                processRayTx(txn, startTime);
            }
        }
        if (filterType === 'payerAddressRay') {
            if (data?.transaction) {
                const startTime = Date.now();
                const txn = TXN_FORMATTER.formTransactionFromJson(
                    data.transaction,
                    startTime,
                );
                processRayTxPayer(txn, startTime);
            }
        }
    }
}

async function subscribeGRPC(
    client: Client,
    walletAddresses: string[]
): Promise<void> {
    try {
        const stream = await client.subscribe();

        stream.on("data", async (data: any) => {
            processIncomingData(data).catch((err) =>
                logger.error(`Error processing data: ${err}`)
            );
        });

        stream.on("end", () => {
            logger.error("Subscription stream ended, attempting to reconnect...");
            setTimeout(() => subscribeGRPC(client, walletAddresses), 5000);
        });

        stream.on("error", (error: any) => {
            logger.error(`Subscription error: ${error}`);
            setTimeout(() => subscribeGRPC(client, walletAddresses), 5000);
        });

        const request: SubscribeRequest = {
            slots: {},
            accounts: {},
            transactions: {
                pump: {
                    accountInclude: walletAddresses,
                    accountExclude: [],
                    accountRequired: ["6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P"],
                },
                raydium: {
                    accountInclude: walletAddresses,
                    accountExclude: [],
                    accountRequired: ["675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8"],
                },
                payerAddressPump: {
                    accountInclude: [PAYER.publicKey.toBase58()],
                    accountExclude: [],
                    accountRequired: ["6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P"],
                },
                payerAddressRay: {
                    accountInclude: [PAYER.publicKey.toBase58()],
                    accountExclude: [],
                    accountRequired: ["675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8"],
                },
            },
            blocks: {},
            blocksMeta: { block: [] },
            accountsDataSlice: [],
            commitment: CommitmentLevel.PROCESSED,
            entry: {},
            transactionsStatus: {},
        };

        await new Promise<void>((resolve, reject) => {
            stream.write(request, (err: Error | null | undefined) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });

        logger.info("Subscription to GRPC started successfully.");
    } catch (error) {
        logger.error(`Error setting up subscription: ${error}`);
        setTimeout(() => subscribeGRPC(client, walletAddresses), 5000);
    }
}

async function main() {
    await subscribeGRPC(client, walletAddresses);
}

main().catch((error) => {
    logger.error(`Fatal error in main: ${error}`);
    process.exit(1);
});
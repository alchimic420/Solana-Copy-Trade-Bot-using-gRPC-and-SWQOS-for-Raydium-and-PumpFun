# Solana Copy Trading Bot using gRPC and SWQOS for Raydium and PumpFun

Having your own copy trading bot is essential for anyone serious about trading on the Solana network.
With this bot, you have: 
 - the flexibility to change RPC nodes on your own terms, allowing you to manage your trading environment efficiently.
 - bot is using gRPC connection to track donor trades
 - bot is sending buy/sell transactions using Jito bundles AND SQWoS
 - copy trading for unlimited amount of wallets: The bot can seamlessly copy trade for any number of wallets.
 - percentage mechanism: It utilizes a percentage-based mechanism; for example, if the donor is buying for 1 SOL and you set it to 10%, the bot will execute a purchase for 0.1 SOL.
 - by adding one functionm, and custumising it like you want, you can add telegram notifications about trades

This code is tailored for individuals who have at LEAST A BASIC understanding of coding. 
While the full code is 100% functional, it is designed to be improved and customized based on your specific needs and preferences.

Currently, I am in the process of developing a similar bot in Rust, aiming to enhance and refine all functionalities to ensure a superior trading experience.

̶С̶A̶U̶T̶I̶O̶N̶:̶
̶S̶o̶m̶e̶ ̶o̶f̶ ̶w̶a̶l̶l̶e̶t̶s̶ ̶y̶o̶u̶ ̶m̶a̶y̶ ̶w̶a̶n̶t̶ ̶t̶o̶ ̶c̶o̶p̶y̶ ̶t̶r̶a̶d̶e̶,̶ ̶d̶o̶n̶t̶ ̶u̶s̶e̶ ̶s̶t̶a̶n̶d̶a̶r̶t̶ ̶t̶r̶a̶n̶s̶a̶c̶t̶i̶o̶n̶s̶.̶ ̶Y̶o̶u̶ ̶m̶a̶y̶ ̶n̶e̶e̶d̶ ̶t̶o̶ ̶a̶d̶a̶p̶t̶ ̶t̶h̶e̶ ̶c̶o̶d̶e̶ ̶f̶o̶r̶ ̶y̶o̶u̶r̶ ̶s̶p̶e̶c̶i̶f̶i̶c̶ ̶w̶a̶l̶l̶e̶t̶s̶.̶ ̶I̶ ̶m̶e̶a̶n̶,̶ ̶t̶h̶e̶ ̶P̶u̶m̶p̶F̶u̶n̶ ̶B̶u̶y̶ ̶i̶n̶s̶t̶r̶u̶c̶t̶i̶o̶n̶ ̶i̶n̶d̶e̶x̶ ̶m̶a̶y̶ ̶n̶e̶e̶d̶ ̶t̶o̶ ̶b̶e̶ ̶m̶o̶d̶i̶f̶i̶e̶d̶/̶h̶a̶r̶d̶c̶o̶d̶e̶d̶.̶
̶T̶h̶a̶t̶s̶ ̶w̶h̶y̶,̶ ̶y̶o̶u̶ ̶n̶e̶e̶d̶ ̶t̶o̶ ̶h̶a̶v̶e̶ ̶a̶t̶ ̶l̶e̶a̶s̶t̶ ̶a̶ ̶l̶i̶t̶t̶l̶e̶ ̶o̶f̶ ̶c̶o̶d̶i̶n̶g̶ ̶e̶x̶p̶e̶r̶i̶e̶n̶c̶e̶.̶
FIXED

IF YOU WANT TO TEST:
Yes, I can share my screen via telegram, and ill copy wallet you want in real time.

Pricing and Contact  
The full TypeScript code is available for 6 SOL. If you're interested, feel free to reach out to me on Telegram: @mayneman (https://t.me/mayneman).

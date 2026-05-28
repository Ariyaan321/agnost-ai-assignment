1. create agnost-sdk -> cd agnost-sdk

2. 
npm install @opentelemetry/sdk-node @opentelemetry/exporter-trace-otlp-http
npm install -D typescript @types/node
npx tsc --init

3. Observability UI on port 8080
- go to agnost-sdk/index.ts (in fun initAgnost) -> uncomment `startLocalUiServer(port)`
- pros: View Observability UI on port 8080
- cons: agnost-server stops running since port 8080 is occupied -> no data upserted to DB


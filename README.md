# Agnost-SDK for self-improving layer of AI Agents

This repository contains the SDK to instrument and observe AI Agents telemetry signals

## Overview

1. **OpenTelemetry**: This SDK uses OpenTelemetry framework to instrument & observe signals since it is the go-to standard for AI Agents observability
2. **agnost-sdk**: This folder contais the code for our SDK that acts as the **integration mode for tools like Agnost**, for agents built via Vercel AI, OpenAI, Mastra SDKs etc
3. **vercel-agent**: Currently this repo only contains a vercel-agent demo to showcase the objective
4. **agnost-server**: This folder simulates the approach for a 3rd party tool like Agnost to collect/fetch **traces** from an endpoint and upsert to their DB(here MongoDB is used)


## Manual Setup
> **Note:** There are two ways to run the application as shown below.

<div style="overflow-x:auto">
  
| agnost-server listening on port 8080 & upsert traces data to MongoDB | agnost-sdk observability UI on port 8080 |
|---|---|
| comment-out `startLocalUiServer(port)` in `agnost-sdk/index.ts` file located at start of `initAgnost()` before building agnost-sdk | uncomment `startLocalUiServer(port)` & build agnost-sdk |
| `/agnost-server` -> npm start & then `/vercel-agent` -> npm run instrument | `/vercel-agent` -> npm run instrument |
| <img width="1539" height="1000" alt="image" src="https://github.com/user-attachments/assets/236ef2e8-8912-48ba-8555-7964d0bab803" /> | <img width="1919" height="1004" alt="image" src="https://github.com/user-attachments/assets/acc1b490-807b-4425-b713-d41f95631050" /> |


</div>

---



### 1. Navigate to agnost-sdk

```bash
cd agnost-sdk
```

### 2. Install Dependencies and Build agnost-sdk

```bash
npm i
```

```bash
npm run build
```

### 3. Navigate to agnost-server
> **Note:** For agnost-server to receive traces and upsert data in MongoDB you must `comment out` the `startLocalUiServer(port)` function call in `agnost-sdk/index.ts`(before building agnost-sdk) located at the start of `initAgnost(config: { port?: number } = {})` function. 

```bash
cd agnost-server
```

### 4. Set Environment Variables & Fire the server

`.env` file
```bash
MONGO_URI=
```
```bash
npm start
```

- You will see something like this in the terminal
``` bash
🚀 agnost-server listening on http://localhost:8080
✅ Agnost Server connected to MongoDB
```


### 5. Navigate to vercel-agent

```bash
cd vercel-agent
```

### 6. Set Environment Variables, Install Dependencies and Run vercel-agent Application

`.env` file. Get API Key at [Groq API Key](https://console.groq.com/keys)
```bash
GROQ_API_KEY=... 
```

```bash
npm i
```

```bash
npm run instrument
```
- You should see this in the terminal
```bash
[Agnost] Telemetry bridge active. Sending data to port 8080
```

🎉 Your application is now up and running!

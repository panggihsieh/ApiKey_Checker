export const curatedProviders = [
  {
    id: "openai",
    name: "OpenAI / Codex",
    envVars: ["OPENAI_API_KEY"],
    rank: 1,
  },
  {
    id: "anthropic",
    name: "Anthropic Claude",
    envVars: ["ANTHROPIC_API_KEY"],
    rank: 2,
  },
  {
    id: "google",
    name: "Google Gemini",
    envVars: ["GEMINI_API_KEY", "GOOGLE_API_KEY"],
    rank: 3,
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    envVars: ["DEEPSEEK_API_KEY"],
    rank: 4,
  },
  {
    id: "xai",
    name: "xAI Grok",
    envVars: ["XAI_API_KEY"],
    rank: 5,
  },
  {
    id: "mistral",
    name: "Mistral AI",
    envVars: ["MISTRAL_API_KEY"],
    rank: 6,
  },
  {
    id: "cohere",
    name: "Cohere",
    envVars: ["COHERE_API_KEY"],
    rank: 7,
  },
  {
    id: "meta",
    name: "Meta Llama",
    envVars: ["META_API_KEY", "LLAMA_API_KEY"],
    rank: 8,
  },
  {
    id: "alibaba",
    name: "Alibaba Qwen / DashScope",
    envVars: ["DASHSCOPE_API_KEY"],
    rank: 9,
  },
  {
    id: "baidu",
    name: "Baidu ERNIE / Qianfan",
    envVars: ["QIANFAN_ACCESS_KEY", "QIANFAN_SECRET_KEY"],
    rank: 10,
  },
  {
    id: "moonshot",
    name: "Moonshot / Kimi",
    envVars: ["MOONSHOT_API_KEY"],
    rank: 11,
  },
  {
    id: "zhipu",
    name: "Zhipu AI / GLM",
    envVars: ["ZHIPUAI_API_KEY"],
    rank: 12,
  },
];

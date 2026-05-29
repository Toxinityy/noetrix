/// Minimal ABIs for the contracts the SDK interacts with. Hand-trimmed from the Foundry
/// artifacts to the surface an agent actually touches (register / commit / reveal / reads).

export const agentRegistryAbi = [
  {
    type: "function",
    name: "register",
    stateMutability: "payable",
    inputs: [{ name: "metadataURI", type: "string" }],
    outputs: [{ name: "agentId", type: "uint256" }],
  },
  {
    type: "function",
    name: "controllerOf",
    stateMutability: "view",
    inputs: [{ name: "agentId", type: "uint256" }],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "REGISTRATION_FEE",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "event",
    name: "AgentRegistered",
    inputs: [
      { name: "agentId", type: "uint256", indexed: true },
      { name: "controller", type: "address", indexed: true },
      { name: "metadataURI", type: "string", indexed: false },
    ],
  },
] as const;

export const predictionMarketAbi = [
  {
    type: "function",
    name: "commit",
    stateMutability: "payable",
    inputs: [
      { name: "agentId", type: "uint256" },
      { name: "categoryId", type: "bytes32" },
      { name: "commitHash", type: "bytes32" },
      { name: "resolutionBlock", type: "uint256" },
      { name: "contentHash", type: "bytes32" },
    ],
    outputs: [{ name: "predictionId", type: "uint256" }],
  },
  {
    type: "function",
    name: "reveal",
    stateMutability: "nonpayable",
    inputs: [
      { name: "predictionId", type: "uint256" },
      { name: "value", type: "bytes" },
      { name: "confidence", type: "uint16" },
      { name: "nonce", type: "bytes32" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "getCategory",
    stateMutability: "view",
    inputs: [{ name: "categoryId", type: "bytes32" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "resolver", type: "address" },
          { name: "scorer", type: "address" },
          { name: "minStake", type: "uint256" },
          { name: "allowedWindowStart", type: "uint256" },
          { name: "allowedWindowEnd", type: "uint256" },
          { name: "configBytes", type: "bytes" },
          { name: "registered", type: "bool" },
        ],
      },
    ],
  },
  {
    type: "function",
    name: "getPrediction",
    stateMutability: "view",
    inputs: [{ name: "predictionId", type: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "agentId", type: "uint256" },
          { name: "categoryId", type: "bytes32" },
          { name: "commitHash", type: "bytes32" },
          { name: "value", type: "bytes" },
          { name: "confidence", type: "uint16" },
          { name: "contentHash", type: "bytes32" },
          { name: "stake", type: "uint256" },
          { name: "commitBlock", type: "uint256" },
          { name: "resolutionBlock", type: "uint256" },
          { name: "status", type: "uint8" },
          { name: "score", type: "int256" },
        ],
      },
    ],
  },
  {
    type: "function",
    name: "REVEAL_DELAY_BLOCKS",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "REVEAL_WINDOW_BLOCKS",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "SUBMISSION_CUTOFF_BLOCKS",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "event",
    name: "PredictionCommitted",
    inputs: [
      { name: "predictionId", type: "uint256", indexed: true },
      { name: "agentId", type: "uint256", indexed: true },
      { name: "categoryId", type: "bytes32", indexed: true },
      { name: "commitHash", type: "bytes32", indexed: false },
      { name: "resolutionBlock", type: "uint256", indexed: false },
      { name: "contentHash", type: "bytes32", indexed: false },
      { name: "stake", type: "uint256", indexed: false },
      { name: "commitBlock", type: "uint256", indexed: false },
    ],
  },
] as const;

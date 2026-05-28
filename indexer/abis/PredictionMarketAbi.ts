export const PredictionMarketAbi = [
  {
    "type": "constructor",
    "inputs": [
      {
        "name": "initialOwner",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "registry",
        "type": "address",
        "internalType": "contract IAgentRegistry"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "BPS_DENOMINATOR",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "CANCEL_REFUND_BPS",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "FORFEIT_CALLER_BPS",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "MAX_CONFIDENCE_BPS",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "MIN_RESOLUTION_OFFSET",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "REVEAL_DELAY_BLOCKS",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "REVEAL_WINDOW_BLOCKS",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "SUBMISSION_CUTOFF_BLOCKS",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "agentRegistry",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "contract IAgentRegistry"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "bonusPool",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "cancel",
    "inputs": [
      {
        "name": "predictionId",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "commit",
    "inputs": [
      {
        "name": "agentId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "categoryId",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "commitHash",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "resolutionBlock",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "contentHash",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "outputs": [
      {
        "name": "predictionId",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "payable"
  },
  {
    "type": "function",
    "name": "forfeitUnrevealed",
    "inputs": [
      {
        "name": "predictionId",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "getCategory",
    "inputs": [
      {
        "name": "categoryId",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "tuple",
        "internalType": "struct IPredictionMarket.Category",
        "components": [
          {
            "name": "resolver",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "scorer",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "minStake",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "allowedWindowStart",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "allowedWindowEnd",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "configBytes",
            "type": "bytes",
            "internalType": "bytes"
          },
          {
            "name": "registered",
            "type": "bool",
            "internalType": "bool"
          }
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getPrediction",
    "inputs": [
      {
        "name": "predictionId",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "tuple",
        "internalType": "struct IPredictionMarket.Prediction",
        "components": [
          {
            "name": "agentId",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "categoryId",
            "type": "bytes32",
            "internalType": "bytes32"
          },
          {
            "name": "commitHash",
            "type": "bytes32",
            "internalType": "bytes32"
          },
          {
            "name": "value",
            "type": "bytes",
            "internalType": "bytes"
          },
          {
            "name": "confidence",
            "type": "uint16",
            "internalType": "uint16"
          },
          {
            "name": "contentHash",
            "type": "bytes32",
            "internalType": "bytes32"
          },
          {
            "name": "stake",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "commitBlock",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "resolutionBlock",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "status",
            "type": "uint8",
            "internalType": "enum IPredictionMarket.PredictionStatus"
          },
          {
            "name": "score",
            "type": "int256",
            "internalType": "int256"
          }
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "latestRevealedPrediction",
    "inputs": [
      {
        "name": "agentId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "categoryId",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "nextPredictionId",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "owner",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "registerCategory",
    "inputs": [
      {
        "name": "categoryId",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "resolver",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "scorer",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "minStake",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "allowedWindowStart",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "allowedWindowEnd",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "configBytes",
        "type": "bytes",
        "internalType": "bytes"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "renounceOwnership",
    "inputs": [],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "reveal",
    "inputs": [
      {
        "name": "predictionId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "value",
        "type": "bytes",
        "internalType": "bytes"
      },
      {
        "name": "confidence",
        "type": "uint16",
        "internalType": "uint16"
      },
      {
        "name": "nonce",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "scoringEngine",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "setBonusPool",
    "inputs": [
      {
        "name": "newBonusPool",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "setScore",
    "inputs": [
      {
        "name": "predictionId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "score",
        "type": "int256",
        "internalType": "int256"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "setScoringEngine",
    "inputs": [
      {
        "name": "newScoringEngine",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "settleStake",
    "inputs": [
      {
        "name": "predictionId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "returnAmount",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "bonusAmount",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "resolverReward",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "resolver",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "transferOwnership",
    "inputs": [
      {
        "name": "newOwner",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "event",
    "name": "BonusPoolSet",
    "inputs": [
      {
        "name": "bonusPool",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "CategoryRegistered",
    "inputs": [
      {
        "name": "categoryId",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      },
      {
        "name": "resolver",
        "type": "address",
        "indexed": false,
        "internalType": "address"
      },
      {
        "name": "scorer",
        "type": "address",
        "indexed": false,
        "internalType": "address"
      },
      {
        "name": "minStake",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "allowedWindowStart",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "allowedWindowEnd",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "OwnershipTransferred",
    "inputs": [
      {
        "name": "previousOwner",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "newOwner",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "PredictionCancelled",
    "inputs": [
      {
        "name": "predictionId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "refundAmount",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "slashedAmount",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "PredictionCommitted",
    "inputs": [
      {
        "name": "predictionId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "agentId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "categoryId",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      },
      {
        "name": "commitHash",
        "type": "bytes32",
        "indexed": false,
        "internalType": "bytes32"
      },
      {
        "name": "resolutionBlock",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "contentHash",
        "type": "bytes32",
        "indexed": false,
        "internalType": "bytes32"
      },
      {
        "name": "stake",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "commitBlock",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "PredictionForfeited",
    "inputs": [
      {
        "name": "predictionId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "caller",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "callerReward",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "poolAmount",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "PredictionResolved",
    "inputs": [
      {
        "name": "predictionId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "score",
        "type": "int256",
        "indexed": false,
        "internalType": "int256"
      },
      {
        "name": "returnAmount",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "bonusAmount",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "resolverReward",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "resolver",
        "type": "address",
        "indexed": false,
        "internalType": "address"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "PredictionRevealed",
    "inputs": [
      {
        "name": "predictionId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "value",
        "type": "bytes",
        "indexed": false,
        "internalType": "bytes"
      },
      {
        "name": "confidence",
        "type": "uint16",
        "indexed": false,
        "internalType": "uint16"
      },
      {
        "name": "revealBlock",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "ScoringEngineSet",
    "inputs": [
      {
        "name": "scoringEngine",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      }
    ],
    "anonymous": false
  },
  {
    "type": "error",
    "name": "BonusPoolNotSet",
    "inputs": []
  },
  {
    "type": "error",
    "name": "CancelAfterResolutionBlock",
    "inputs": []
  },
  {
    "type": "error",
    "name": "CategoryAlreadyRegistered",
    "inputs": []
  },
  {
    "type": "error",
    "name": "CategoryNotRegistered",
    "inputs": []
  },
  {
    "type": "error",
    "name": "CommitHashMismatch",
    "inputs": []
  },
  {
    "type": "error",
    "name": "ConfidenceOutOfRange",
    "inputs": []
  },
  {
    "type": "error",
    "name": "ForfeitWindowNotElapsed",
    "inputs": []
  },
  {
    "type": "error",
    "name": "InvalidCategoryConfig",
    "inputs": []
  },
  {
    "type": "error",
    "name": "InvalidStatusForOperation",
    "inputs": []
  },
  {
    "type": "error",
    "name": "NotAgentController",
    "inputs": []
  },
  {
    "type": "error",
    "name": "OnlyScoringEngine",
    "inputs": []
  },
  {
    "type": "error",
    "name": "OwnableInvalidOwner",
    "inputs": [
      {
        "name": "owner",
        "type": "address",
        "internalType": "address"
      }
    ]
  },
  {
    "type": "error",
    "name": "OwnableUnauthorizedAccount",
    "inputs": [
      {
        "name": "account",
        "type": "address",
        "internalType": "address"
      }
    ]
  },
  {
    "type": "error",
    "name": "PredictionDoesNotExist",
    "inputs": []
  },
  {
    "type": "error",
    "name": "ReentrancyGuardReentrantCall",
    "inputs": []
  },
  {
    "type": "error",
    "name": "ResolutionOutsideAllowedWindow",
    "inputs": []
  },
  {
    "type": "error",
    "name": "ResolutionTooSoon",
    "inputs": []
  },
  {
    "type": "error",
    "name": "RevealTooCloseToResolution",
    "inputs": []
  },
  {
    "type": "error",
    "name": "RevealTooEarly",
    "inputs": []
  },
  {
    "type": "error",
    "name": "RevealTooLate",
    "inputs": []
  },
  {
    "type": "error",
    "name": "StakeBelowMinimum",
    "inputs": []
  },
  {
    "type": "error",
    "name": "StakeConservationViolated",
    "inputs": []
  },
  {
    "type": "error",
    "name": "TransferFailed",
    "inputs": []
  },
  {
    "type": "error",
    "name": "ZeroAddress",
    "inputs": []
  }
] as const;

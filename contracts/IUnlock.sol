//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

interface IUnlock {
    struct Ask {
        address owner;
        address token;
        uint256 amount;
    }

    // The struct for a key
    struct KeyData {
        uint256 expireAt;
        bool transferable;
        string contentHash;
    }

    struct EIP712Signature {
        uint256 deadline;
        uint8 v;
        bytes32 r;
        bytes32 s;
    }
}

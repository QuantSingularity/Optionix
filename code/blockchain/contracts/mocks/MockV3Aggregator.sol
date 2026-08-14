// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";

/**
 * @title MockV3Aggregator
 * @dev Minimal mock of a Chainlink price feed for local testing only.
 */
contract MockV3Aggregator is AggregatorV3Interface {
    uint8 public immutable override decimals;
    string public override description = "Mock Aggregator";
    uint256 public override version = 0;

    int256 public latestAnswer;
    uint256 public latestTimestamp;
    uint80 public latestRound;

    mapping(uint80 => int256) public getAnswer;
    mapping(uint80 => uint256) public getTimestamp;

    constructor(uint8 _decimals, int256 _initialAnswer) {
        decimals = _decimals;
        _updateAnswer(_initialAnswer);
    }

    function updateAnswer(int256 _answer) external {
        _updateAnswer(_answer);
    }

    function _updateAnswer(int256 _answer) internal {
        latestAnswer = _answer;
        latestTimestamp = block.timestamp;
        latestRound++;
        getAnswer[latestRound] = _answer;
        getTimestamp[latestRound] = block.timestamp;
    }

    function getRoundData(
        uint80 _roundId
    )
        external
        view
        override
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        )
    {
        return (
            _roundId,
            getAnswer[_roundId],
            getTimestamp[_roundId],
            getTimestamp[_roundId],
            _roundId
        );
    }

    function latestRoundData()
        external
        view
        override
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        )
    {
        return (
            latestRound,
            latestAnswer,
            latestTimestamp,
            latestTimestamp,
            latestRound
        );
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title MockERC20
 * @dev Minimal mintable ERC20 for local testing only.
 */
contract MockERC20 is ERC20 {
    constructor(
        string memory _name,
        string memory _symbol,
        uint256 _initialSupply
    ) ERC20(_name, _symbol) {
        _mint(msg.sender, _initialSupply);
    }

    function mint(address _to, uint256 _amount) external {
        _mint(_to, _amount);
    }
}

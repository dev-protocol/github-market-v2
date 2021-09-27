// SPDX-License-Identifier: MPL-2.0
pragma solidity 0.8.4;
import {IMarket} from "@devprotocol/protocol-l2/contracts/interface/IMarket.sol";

contract MockMarket is IMarket {
	address public latestMetrics;
	address public override behavior;

	constructor(address _behavior) {
		behavior = _behavior;
	}

	function authenticate(address, string[] memory)
		external
		pure
		override
		returns (bool)
	{
		return true;
	}

	function authenticateFromPropertyFactory(
		address,
		address,
		string[] memory
	) external pure override returns (bool) {
		return true;
	}

	function setLatestMetrics(address _metrics) external {
		latestMetrics = _metrics;
	}

	function authenticatedCallback(address, bytes32)
		external
		view
		override
		returns (address)
	{
		return latestMetrics;
	}

	function name() external pure override returns (string memory) {
		return "";
	}

	// solium-disable-next-line no-empty-blocks
	function deauthenticate(address) external pure override {}

	function schema() external pure override returns (string memory) {
		return "";
	}

	function issuedMetrics() external pure override returns (uint256) {
		return 0;
	}

	function enabled() external pure override returns (bool) {
		return true;
	}

	function votingEndTimestamp() external pure override returns (uint256) {
		return 0;
	}

	// solium-disable-next-line no-empty-blocks
	function toEnable() external override {}
}

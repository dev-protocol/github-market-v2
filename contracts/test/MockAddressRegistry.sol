// SPDX-License-Identifier: MPL-2.0
pragma solidity 0.8.4;

contract MockAddressRegistry {
	mapping(bytes32 => address) private reg;

	function setRegistry(string memory _key, address _addr) external {
		bytes32 key = keccak256(abi.encodePacked(_key));
		reg[key] = _addr;
	}

	function registries(string memory _key) external view returns (address) {
		bytes32 key = keccak256(abi.encodePacked(_key));
		return reg[key];
	}
}

/* eslint-disable new-cap */
/* eslint-disable @typescript-eslint/await-thenable */
/* eslint-disable spaced-comment */

import { ethers } from 'hardhat'

async function main() {
	//!please check!!!!!!!!!
	const marketBehaviorProxyAddress = ''
	const addRole = ''
	//!!!!!!!!!!!!!!!!!!!!!!

	console.log(`market behavior address:${marketBehaviorProxyAddress}`)
	// GitHubMarket
	const gitHubMarketFactory = await ethers.getContractFactory('GitHubMarket')
	const gitHubMarket = await gitHubMarketFactory.attach(
		marketBehaviorProxyAddress
	)
	await gitHubMarket.addKhaosRole(addRole)
	const khaosRole = await gitHubMarket.KHAOS_ROLE()
	console.log(`khaos role:${khaosRole}`)
	const result = await gitHubMarket.hasRole(khaosRole, addRole)
	console.log('result:', result)
}

main()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error(error)
		process.exit(1)
	})

// Memo
// set marketBehaviorProxyAddress and update .env file
// and execute this command
// npx hardhat run --network arbitrumRinkeby scripts/set-khaos-role.ts

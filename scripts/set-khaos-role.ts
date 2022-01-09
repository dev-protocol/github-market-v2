/* eslint-disable new-cap */
/* eslint-disable @typescript-eslint/await-thenable */
/* eslint-disable @typescript-eslint/no-non-null-assertion */

import { ethers } from 'hardhat'

async function main() {
	const [deployer] = await ethers.getSigners()
	console.log('the account:', deployer.address)
	console.log('Account balance:', (await deployer.getBalance()).toString())

	const marketBehaviorProxyAddress = process.env.GITHUB_MARKET_PROXY!
	const addRole = process.env.ADD_ROLE!

	console.log(`market behavior address:${marketBehaviorProxyAddress}`)
	console.log(`add role address:${addRole}`)

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
// Add the market behavior proxy address and the address of the wallet where you want to add the khaos roll to the .env file.
// and execute this command
// npx hardhat run --network arbitrumRinkeby scripts/set-khaos-role.ts

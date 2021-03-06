/* eslint-disable capitalized-comments */
/* eslint-disable @typescript-eslint/no-non-null-assertion */

import { ethers } from 'hardhat'

async function main() {
	const [deployer] = await ethers.getSigners()
	console.log('the account:', deployer.address)
	console.log('Account balance:', (await deployer.getBalance()).toString())

	const adminAddress = process.env.ADMIN!
	console.log('admin:', adminAddress)

	// GitHubMarket
	const gitHubMarketFactory = await ethers.getContractFactory('GitHubMarket')
	const gitHubMarket = await gitHubMarketFactory.deploy()
	await gitHubMarket.deployed()
	const data = ethers.utils.arrayify('0x')

	// MarketProxy
	const marketProxyFactory = await ethers.getContractFactory('MarketProxy')
	const marketProxy = await marketProxyFactory.deploy(
		gitHubMarket.address,
		adminAddress,
		data
	)
	await marketProxy.deployed()

	const proxy = gitHubMarketFactory.attach(marketProxy.address)
	await proxy.initialize()

	console.log('github market deployed to:', gitHubMarket.address)
	console.log('market proxy deployed to:', marketProxy.address)
}

main()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error(error)
		process.exit(1)
	})

// memo
// add admin address to .env file
// and execute this command
// npx hardhat run --network arbitrumRinkeby scripts/deploy.ts

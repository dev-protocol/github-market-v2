/* eslint-disable capitalized-comments */
/* eslint-disable @typescript-eslint/no-non-null-assertion */

import { ethers } from 'hardhat'

async function main() {
	const [deployer] = await ethers.getSigners()
	console.log('the account:', deployer.address)
	console.log('Account balance:', (await deployer.getBalance()).toString())

	const githubMarketProxy = process.env.GITHUB_MARKET_PROXY!
	console.log('github market:', githubMarketProxy)

	// GitHubMarket
	const gitHubMarketFactory = await ethers.getContractFactory('GitHubMarket')

	const proxy = gitHubMarketFactory.attach(githubMarketProxy)
	await proxy.initialize()
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

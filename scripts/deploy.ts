/* eslint-disable spaced-comment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import { ethers } from 'hardhat'

async function main() {
	//!please check!!!!!!!!!
	const registryAddress = ''
	//!!!!!!!!!!!!!!!!!!!!!!

	// GitHubMarket
	const gitHubMarketFactory = await ethers.getContractFactory('GitHubMarket')
	const gitHubMarket = await gitHubMarketFactory.deploy()
	await gitHubMarket.deployed()

	// MarketAdmin
	const marketAdminFactory = await ethers.getContractFactory('MarketAdmin')
	const marketAdmin = await marketAdminFactory.deploy()
	await marketAdmin.deployed()

	const data = ethers.utils.arrayify('0x')

	// MarketProxy
	const marketProxyFactory = await ethers.getContractFactory('MarketProxy')
	const marketProxy = await marketProxyFactory.deploy(
		gitHubMarket.address,
		marketAdmin.address,
		data
	)
	await marketProxy.deployed()

	const proxy = gitHubMarketFactory.attach(marketProxy.address)
	await proxy.initialize(registryAddress)

	console.log('github market deployed to:', gitHubMarket.address)
	console.log('market admin deployed to:', marketAdmin.address)
	console.log('market proxy deployed to:', marketProxy.address)
}

main()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error(error)
		process.exit(1)
	})

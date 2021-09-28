/* eslint-disable new-cap */
/* eslint-disable no-await-in-loop */
/* eslint-disable @typescript-eslint/prefer-readonly-parameter-types */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */

import { expect, use } from 'chai'
import { constants } from 'ethers'
import { ethers, waffle } from 'hardhat'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { solidity } from 'ethereum-waffle'
import GitHubMarketArtifact from '../artifacts/contracts/GitHubMarket.sol/GitHubMarket.json'
import MarketAdminArtifact from '../artifacts/contracts/MarketAdmin.sol/MarketAdmin.json'
import MarketProxyArtifact from '../artifacts/contracts/MarketProxy.sol/MarketProxy.json'
import { GitHubMarket } from '../src/types/GitHubMarket'
import { MarketAdmin } from '../src/types/MarketAdmin'
import { MarketProxy } from '../src/types/MarketProxy'

use(solidity)

const { deployContract, deployMockContract, provider } = waffle

type signers = {
	deployer: SignerWithAddress
	operator: SignerWithAddress
	khaos: SignerWithAddress
	user: SignerWithAddress
	marketFactory: SignerWithAddress
	associatedMarket: SignerWithAddress
}

type markets = {
	deployer: GitHubMarket
	operator: GitHubMarket
	khaos: GitHubMarket
	user: GitHubMarket
	marketFactory: GitHubMarket
	associatedMarket: GitHubMarket
}

const getSigners = async (): Promise<signers> => {
	const [deployer, operator, khaos, user, marketFactory, associatedMarket] =
		await ethers.getSigners()
	return {
		deployer,
		operator,
		khaos,
		user,
		marketFactory,
		associatedMarket,
	}
}

const getMarketsWithoutAdmin = (markets: markets): GitHubMarket[] => [
	markets.operator,
	markets.khaos,
	markets.user,
	markets.marketFactory,
	markets.associatedMarket,
]

const init = async (): Promise<markets> => {
	const signers = await getSigners()
	const marketBehavior = (await deployContract(
		signers.deployer,
		GitHubMarketArtifact
	)) as GitHubMarket
	const admin = (await deployContract(
		signers.deployer,
		MarketAdminArtifact
	)) as MarketAdmin
	const data = ethers.utils.arrayify('0x')
	const proxy = (await deployContract(signers.deployer, MarketProxyArtifact, [
		marketBehavior.address,
		admin.address,
		data,
	])) as MarketProxy
	const gitHubMarketFactory = await ethers.getContractFactory(
		GitHubMarketArtifact.abi,
		GitHubMarketArtifact.bytecode,
		signers.deployer
	)
	const proxyMarket = gitHubMarketFactory.attach(proxy.address) as GitHubMarket
	const reg = await deployMockContract(signers.deployer, [
		{
			inputs: [
				{
					internalType: 'string',
					name: '_key',
					type: 'string',
				},
			],
			name: 'registries',
			outputs: [
				{
					internalType: 'address',
					name: '',
					type: 'address',
				},
			],
			stateMutability: 'view',
			type: 'function',
		},
	])
	await reg.mock.registries
		.withArgs('MarketFactory')
		.returns(signers.marketFactory.address)
	// Await reg.setRegistry('MarketFactory', signers.marketFactory.address)
	await proxyMarket.initialize(reg.address)
	await proxyMarket.addOperatorRole(signers.operator.address)
	await proxyMarket.addKhaosRole(signers.khaos.address)
	return {
		deployer: proxyMarket,
		operator: proxyMarket.connect(signers.operator),
		khaos: proxyMarket.connect(signers.khaos),
		user: proxyMarket.connect(signers.user),
		marketFactory: proxyMarket.connect(signers.marketFactory),
		associatedMarket: proxyMarket.connect(signers.associatedMarket),
	}
}

const init2 = async (): Promise<markets> => {
	const markets = await init()
	const signers = await getSigners()
	await markets.marketFactory.setAssociatedMarket(
		signers.associatedMarket.address
	)
	return markets
}

const init3 = async (): Promise<[markets, string, string]> => {
	const markets = await init2()
	const property = provider.createEmptyWallet()
	const signers = await getSigners()
	await markets.marketFactory.setAssociatedMarket(
		signers.associatedMarket.address
	)
	await markets.associatedMarket.authenticate(
		property.address,
		['user/repository', 'dummy-signature'],
		signers.user.address
	)
	const associatedMarket = await deployMockContract(signers.deployer, [
		{
			inputs: [
				{
					internalType: 'address',
					name: '_property',
					type: 'address',
				},
				{
					internalType: 'bytes32',
					name: '_idHash',
					type: 'bytes32',
				},
			],
			name: 'authenticatedCallback',
			outputs: [
				{
					internalType: 'address',
					name: '',
					type: 'address',
				},
			],
			stateMutability: 'nonpayable',
			type: 'function',
		},
	])
	await markets.marketFactory.setAssociatedMarket(associatedMarket.address)
	const metrics = provider.createEmptyWallet()
	const key = ethers.utils.keccak256(
		ethers.utils.toUtf8Bytes('user/repository')
	)
	await associatedMarket.mock.authenticatedCallback
		.withArgs(property.address, key)
		.returns(metrics.address)
	return [markets, property.address, metrics.address]
}

describe('GitHubMarket', () => {
	describe('initialize', () => {
		describe('success', () => {
			it('set initial value.', async () => {
				const market = (await init()).deployer
				expect(await market.registry()).to.not.equal(constants.AddressZero)
			})
		})
		describe('fail', () => {
			it('Cannot be executed multiple times.', async () => {
				const market = (await init()).deployer
				await expect(
					market.initialize(constants.AddressZero)
				).to.be.revertedWith('Initializable: contract is already initialized')
			})
		})
	})

	describe('name', () => {
		it("Returns this market's name.", async () => {
			const market = (await init()).deployer
			expect(await market.name()).to.equal('GitHub')
		})
	})

	describe('schema', () => {
		it("Returns this market's schema.", async () => {
			const market = (await init()).deployer
			expect(await market.schema()).to.equal(
				'["GitHub Repository (e.g, your/awesome-repos)", "Khaos Public Signature"]'
			)
		})
	})
	describe('pause,unpause', () => {
		describe('success', () => {
			it('Admin can pause state.', async () => {
				const market = (await init()).deployer
				expect(await market.paused()).to.be.equal(false)
				await market.pause()
				expect(await market.paused()).to.be.equal(true)
				await market.unpause()
				expect(await market.paused()).to.be.equal(false)
			})
		})
		describe('fail', () => {
			it('non Admin can not pause state.', async () => {
				const markets = getMarketsWithoutAdmin(await init())
				for (const market of markets) {
					await expect(market.pause()).to.be.reverted
				}
			})
			it('non Admin can not unpause state.', async () => {
				const markets = getMarketsWithoutAdmin(await init())
				for (const market of markets) {
					await expect(market.unpause()).to.be.reverted
				}
			})
			it('Admin can not pause when pause state.', async () => {
				const market = (await init()).deployer
				await market.pause()
				await expect(market.pause()).to.be.revertedWith('Pausable: paused')
			})
			it('Admin can not unpause when unpause state.', async () => {
				const market = (await init()).deployer
				await expect(market.unpause()).to.be.revertedWith(
					'Pausable: not paused'
				)
			})
		})
	})
	describe('addKhaosRole, deleteKhaosRole', () => {
		describe('success', () => {
			it('add khaos role.', async () => {
				const market = (await init()).deployer
				const signers = await getSigners()
				const role = await market.KHAOS_ROLE()
				expect(await market.hasRole(role, signers.user.address)).to.be.equal(
					false
				)
				await market.addKhaosRole(signers.user.address)
				expect(await market.hasRole(role, signers.user.address)).to.be.equal(
					true
				)
			})
			it('delete khaos role.', async () => {
				const market = (await init()).deployer
				const signers = await getSigners()
				const role = await market.KHAOS_ROLE()
				expect(await market.hasRole(role, signers.khaos.address)).to.be.equal(
					true
				)
				await market.deleteKhaosRole(signers.khaos.address)
				expect(await market.hasRole(role, signers.khaos.address)).to.be.equal(
					false
				)
			})
		})
		describe('fail', () => {
			it('non Admin can not add khaos role.', async () => {
				const markets = getMarketsWithoutAdmin(await init())
				const signers = await getSigners()
				for (const market of markets) {
					await expect(market.addKhaosRole(signers.user.address)).to.be.reverted
				}
			})
			it('non Admin can not delete khaos role.', async () => {
				const markets = getMarketsWithoutAdmin(await init())
				const signers = await getSigners()
				for (const market of markets) {
					await expect(market.deleteKhaosRole(signers.khaos.address)).to.be
						.reverted
				}
			})
		})
	})
	describe('addOperatorRole, deleteOperatorRole', () => {
		describe('success', () => {
			it('add operator role.', async () => {
				const market = (await init()).deployer
				const signers = await getSigners()
				const role = await market.OPERATOR_ROLE()
				expect(await market.hasRole(role, signers.user.address)).to.be.equal(
					false
				)
				await market.addOperatorRole(signers.user.address)
				expect(await market.hasRole(role, signers.user.address)).to.be.equal(
					true
				)
			})
			it('delete operator role.', async () => {
				const market = (await init()).deployer
				const signers = await getSigners()
				const role = await market.OPERATOR_ROLE()
				expect(
					await market.hasRole(role, signers.operator.address)
				).to.be.equal(true)
				await market.deleteOperatorRole(signers.operator.address)
				expect(
					await market.hasRole(role, signers.operator.address)
				).to.be.equal(false)
			})
		})
		describe('fail', () => {
			it('non Admin can not add operator role.', async () => {
				const markets = getMarketsWithoutAdmin(await init())
				const signers = await getSigners()
				for (const market of markets) {
					await expect(market.addOperatorRole(signers.user.address)).to.be
						.reverted
				}
			})
			it('non Admin can not delete operator role.', async () => {
				const markets = getMarketsWithoutAdmin(await init())
				const signers = await getSigners()
				for (const market of markets) {
					await expect(market.deleteOperatorRole(signers.operator.address)).to
						.be.reverted
				}
			})
		})
	})
	describe('setAssociatedMarket', () => {
		describe('success', () => {
			it('set associated market.', async () => {
				const markets = await init()
				const signers = await getSigners()
				await markets.marketFactory.setAssociatedMarket(
					signers.associatedMarket.address
				)
				expect(await markets.deployer.associatedMarket()).to.be.equal(
					signers.associatedMarket.address
				)
			})
		})
		describe('fail', () => {
			it('non Admin can not set associated market.', async () => {
				const markets = await init()
				const signers = await getSigners()
				for (const market of [
					markets.deployer,
					markets.operator,
					markets.khaos,
					markets.user,
					markets.associatedMarket,
				]) {
					await expect(
						market.setAssociatedMarket(signers.associatedMarket.address)
					).to.be.revertedWith('illegal sender')
				}
			})
		})
	})

	describe('authenticate', () => {
		describe('success', () => {
			it('Query event data is created.', async () => {
				const markets = await init2()
				const property = provider.createEmptyWallet()
				const signers = await getSigners()
				await expect(
					markets.associatedMarket.authenticate(
						property.address,
						['user/repository', 'dummy-signature'],
						signers.user.address
					)
				)
					.to.emit(markets.associatedMarket, 'Query')
					.withArgs('user/repository', 'dummy-signature', signers.user.address)
			})
		})
		describe('fail', () => {
			it('args length is not 2', async () => {
				const markets = await init2()
				const property = provider.createEmptyWallet()
				const signers = await getSigners()
				await expect(
					markets.associatedMarket.authenticate(
						property.address,
						['user/repository'],
						signers.user.address
					)
				).to.be.revertedWith('args error')
			})
			it('if status is pause, an error occurs.', async () => {
				const markets = await init2()
				await markets.deployer.pause()
				const property = provider.createEmptyWallet()
				const signers = await getSigners()
				await expect(
					markets.associatedMarket.authenticate(
						property.address,
						['user/repository', 'dummy-signature'],
						signers.user.address
					)
				).to.be.revertedWith('Pausable: paused')
			})
			it('Cannot be run from outside the associate market.', async () => {
				const markets = await init2()
				const property = provider.createEmptyWallet()
				const signers = await getSigners()
				for (const market of [
					markets.deployer,
					markets.operator,
					markets.khaos,
					markets.user,
					markets.marketFactory,
				]) {
					await expect(
						market.authenticate(
							property.address,
							['user/repository', 'dummy-signature'],
							signers.user.address
						)
					).to.be.revertedWith('invalid sender')
				}
			})
		})
	})
	describe('khaosCallback', () => {
		const getMarketsWithoutAdminAndKhaos = (
			markets: markets
		): GitHubMarket[] => [
			markets.operator,
			markets.user,
			markets.marketFactory,
			markets.associatedMarket,
		]
		const getAdminAndKhaosMarkets = (markets: markets): GitHubMarket[] => [
			markets.deployer,
			markets.khaos,
		]
		describe('success', () => {
			it('Authenticated event data is created.', async () => {
				const [markets] = await init3()
				const targetMarkets = getAdminAndKhaosMarkets(markets)
				for (const market of targetMarkets) {
					await expect(market.khaosCallback('user/repository', 0, ''))
						.to.emit(market, 'Authenticated')
						.withArgs('user/repository', '0', '')
				}
			})
			it('Registered event data is created.', async () => {
				const [markets, , metrics] = await init3()
				const targetMarkets = getAdminAndKhaosMarkets(markets)
				for (const market of targetMarkets) {
					await expect(market.khaosCallback('user/repository', 0, ''))
						.to.emit(market, 'Registered')
						.withArgs(metrics, 'user/repository')
				}
			})
			it('get id.', async () => {
				const [markets, , metrics] = await init3()
				const targetMarkets = getAdminAndKhaosMarkets(markets)
				for (const market of targetMarkets) {
					await market.khaosCallback('user/repository', 0, '')
					const id = await market.getId(metrics)
					expect(id).to.be.equal('user/repository')
				}
			})
			it('get metrics.', async () => {
				const [markets, , metrics] = await init3()
				const targetMarkets = getAdminAndKhaosMarkets(markets)
				for (const market of targetMarkets) {
					await market.khaosCallback('user/repository', 0, '')
					const result = await market.getMetrics('user/repository')
					expect(result).to.be.equal(metrics)
				}
			})
		})
		describe('fail', () => {
			it('illegal access', async () => {
				const [markets] = await init3()
				const targetMarkets = getMarketsWithoutAdminAndKhaos(markets)
				for (const market of targetMarkets) {
					await expect(
						market.khaosCallback('user/repository', 0, '')
					).to.be.revertedWith('illegal access')
				}
			})
			it('erroe status.', async () => {
				const [markets] = await init3()
				const market = markets.deployer
				await expect(
					market.khaosCallback('user/repository', 1, 'error message')
				).to.be.revertedWith('error message')
			})
			it('not authenticate.', async () => {
				const markets = await init2()
				const signers = await getSigners()
				await markets.marketFactory.setAssociatedMarket(
					signers.associatedMarket.address
				)
				const market = markets.deployer
				await expect(
					market.khaosCallback('user/repository', 0, '')
				).to.be.revertedWith('not while pending')
			})
		})
	})
})
/* eslint-disable new-cap */
/* eslint-disable no-await-in-loop */
import { expect, use } from 'chai'
import { constants } from 'ethers'
import { ethers, waffle } from 'hardhat'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { solidity } from 'ethereum-waffle'
import GitHubMarketArtifact from '../artifacts/contracts/GitHubMarket.sol/GitHubMarket.json'
import MarketAdminArtifact from '../artifacts/contracts/MarketAdmin.sol/MarketAdmin.json'
import MarketProxyArtifact from '../artifacts/contracts/MarketProxy.sol/MarketProxy.json'
import MockAddressRegistryArtifact from '../artifacts/contracts/test/MockAddressRegistry.sol/MockAddressRegistry.json'
import { GitHubMarket } from '../src/types/GitHubMarket'
import { MarketAdmin } from '../src/types/MarketAdmin'
import { MarketProxy } from '../src/types/MarketProxy'
import { MockAddressRegistry } from '../src/types/MockAddressRegistry'

use(solidity)

const { deployContract, provider } = waffle

type signers = {
	deployer: SignerWithAddress
	operator: SignerWithAddress
	khaos: SignerWithAddress
	user: SignerWithAddress
	marketFactory: SignerWithAddress
	associatedMarket: SignerWithAddress
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

describe('GitHubMarket', () => {
	const init = async (): Promise<
		[
			GitHubMarket,
			GitHubMarket,
			GitHubMarket,
			GitHubMarket,
			GitHubMarket,
			GitHubMarket
		]
	> => {
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
		const proxyMarket = gitHubMarketFactory.attach(
			proxy.address
		) as GitHubMarket
		const reg = (await deployContract(
			signers.deployer,
			MockAddressRegistryArtifact
		)) as MockAddressRegistry
		await reg.setRegistry('MarketFactory', signers.marketFactory.address)
		await proxyMarket.initialize(reg.address)
		await proxyMarket.addOperatorRole(signers.operator.address)
		await proxyMarket.addKhaosRole(signers.khaos.address)
		return [
			proxyMarket,
			proxyMarket.connect(signers.operator),
			proxyMarket.connect(signers.khaos),
			proxyMarket.connect(signers.user),
			proxyMarket.connect(signers.associatedMarket),
			proxyMarket.connect(signers.marketFactory),
		]
	}

	describe('initialize', () => {
		describe('success', () => {
			it('set initial value.', async () => {
				const [githubMarket] = await init()
				expect(await githubMarket.registry()).to.not.equal(
					constants.AddressZero
				)
				expect(await githubMarket.priorApproval()).to.equal(true)
			})
		})
		describe('fail', () => {
			it('Cannot be executed multiple times..', async () => {
				const [githubMarket] = await init()
				await expect(
					githubMarket.initialize(constants.AddressZero)
				).to.be.revertedWith('Initializable: contract is already initialized')
			})
		})
	})

	describe('name', () => {
		it("Returns this market's name.", async () => {
			const [githubMarket] = await init()
			expect(await githubMarket.name()).to.equal('GitHub')
		})
	})

	describe('schema', () => {
		it("Returns this market's schema.", async () => {
			const [githubMarket] = await init()
			expect(await githubMarket.schema()).to.equal(
				'["GitHub Repository (e.g, your/awesome-repos)", "Khaos Public Signature"]'
			)
		})
	})
	describe('addPublicSignaturee', () => {
		describe('success', () => {
			it('admin can register a public key.', async () => {
				const [githubMarket] = await init()
				await githubMarket.addPublicSignaturee('dummy-public-key1')
				expect(true).to.be.equal(true)
			})
			it('operator can register a public key.', async () => {
				const [, githubMarketOperator] = await init()
				await githubMarketOperator.addPublicSignaturee('dummy-public-key1')
				expect(true).to.be.equal(true)
			})
		})
		describe('fail', () => {
			it('khaos can not register a public key.', async () => {
				const [, , githubMarketKhaos] = await init()
				await expect(
					githubMarketKhaos.addPublicSignaturee('dummy-public-key')
				).to.be.revertedWith('illegal access')
			})
			it('user can not register a public key.', async () => {
				const [, , , githubMarketUser] = await init()
				await expect(
					githubMarketUser.addPublicSignaturee('dummy-public-key')
				).to.be.revertedWith('illegal access')
			})
		})
	})
	describe('pause,unpause', () => {
		describe('success', () => {
			it('Admin can pause state.', async () => {
				const [marketBehavior] = await init()
				expect(await marketBehavior.paused()).to.be.equal(false)
				await marketBehavior.pause()
				expect(await marketBehavior.paused()).to.be.equal(true)
				await marketBehavior.unpause()
				expect(await marketBehavior.paused()).to.be.equal(false)
			})
		})
		describe('fail', () => {
			it('non Admin can not pause state.', async () => {
				const [, marketOperator, marketKhaos, marketuser] = await init()
				for (const market of [marketOperator, marketKhaos, marketuser]) {
					await expect(market.pause()).to.be.reverted
				}
			})
			it('non Admin can not unpause state.', async () => {
				const [, marketOperator, marketKhaos, marketuser] = await init()
				const markets = [marketOperator, marketKhaos, marketuser]
				for (const market of markets) {
					await expect(market.unpause()).to.be.reverted
				}
			})
			it('Admin can not pause when pause state.', async () => {
				const [marketBehavior] = await init()
				await marketBehavior.pause()
				await expect(marketBehavior.pause()).to.be.revertedWith(
					'Pausable: paused'
				)
			})
			it('Admin can not unpause when unpause state.', async () => {
				const [marketBehavior] = await init()
				await expect(marketBehavior.unpause()).to.be.revertedWith(
					'Pausable: not paused'
				)
			})
		})
	})
	describe('addKhaosRole, deleteKhaosRole', () => {
		describe('success', () => {
			it('add khaos role.', async () => {
				const [marketBehavior] = await init()
				const signers = await getSigners()
				const role = await marketBehavior.KHAOS_ROLE()
				expect(
					await marketBehavior.hasRole(role, signers.user.address)
				).to.be.equal(false)
				await marketBehavior.addKhaosRole(signers.user.address)
				expect(
					await marketBehavior.hasRole(role, signers.user.address)
				).to.be.equal(true)
			})
			it('delete khaos role.', async () => {
				const [marketBehavior] = await init()
				const signers = await getSigners()
				const role = await marketBehavior.KHAOS_ROLE()
				expect(
					await marketBehavior.hasRole(role, signers.khaos.address)
				).to.be.equal(true)
				await marketBehavior.deleteKhaosRole(signers.khaos.address)
				expect(
					await marketBehavior.hasRole(role, signers.khaos.address)
				).to.be.equal(false)
			})
		})
		describe('fail', () => {
			it('non Admin can not add khaos role.', async () => {
				const [, marketOperator, marketKhaos, marketuser] = await init()
				const signers = await getSigners()
				for (const market of [marketOperator, marketKhaos, marketuser]) {
					await expect(market.addKhaosRole(signers.user.address)).to.be.reverted
				}
			})
			it('non Admin can not delete khaos role.', async () => {
				const [, marketOperator, marketKhaos, marketuser] = await init()
				const signers = await getSigners()
				for (const market of [marketOperator, marketKhaos, marketuser]) {
					await expect(market.deleteKhaosRole(signers.khaos.address)).to.be
						.reverted
				}
			})
		})
	})
	describe('addOperatorRole, deleteOperatorRole', () => {
		describe('success', () => {
			it('add operator role.', async () => {
				const [marketBehavior] = await init()
				const signers = await getSigners()
				const role = await marketBehavior.OPERATOR_ROLE()
				expect(
					await marketBehavior.hasRole(role, signers.user.address)
				).to.be.equal(false)
				await marketBehavior.addOperatorRole(signers.user.address)
				expect(
					await marketBehavior.hasRole(role, signers.user.address)
				).to.be.equal(true)
			})
			it('delete operator role.', async () => {
				const [marketBehavior] = await init()
				const signers = await getSigners()
				const role = await marketBehavior.OPERATOR_ROLE()
				expect(
					await marketBehavior.hasRole(role, signers.operator.address)
				).to.be.equal(true)
				await marketBehavior.deleteOperatorRole(signers.operator.address)
				expect(
					await marketBehavior.hasRole(role, signers.operator.address)
				).to.be.equal(false)
			})
		})
		describe('fail', () => {
			it('non Admin can not add operator role.', async () => {
				const [, marketOperator, marketKhaos, marketuser] = await init()
				const signers = await getSigners()
				for (const market of [marketOperator, marketKhaos, marketuser]) {
					await expect(market.addOperatorRole(signers.user.address)).to.be
						.reverted
				}
			})
			it('non Admin can not delete operator role.', async () => {
				const [, marketOperator, marketKhaos, marketuser] = await init()
				const signers = await getSigners()
				for (const market of [marketOperator, marketKhaos, marketuser]) {
					await expect(market.deleteOperatorRole(signers.operator.address)).to
						.be.reverted
				}
			})
		})
	})
	describe('setAssociatedMarket', () => {
		describe('success', () => {
			it('set associated market.', async () => {
				const [marketBehavior] = await init()
				const signers = await getSigners()
				const marketBehaviorMarketFactory = marketBehavior.connect(
					signers.marketFactory
				)
				await marketBehaviorMarketFactory.setAssociatedMarket(
					signers.associatedMarket.address
				)
				expect(
					await marketBehaviorMarketFactory.associatedMarket()
				).to.be.equal(signers.associatedMarket.address)
			})
		})
		describe('fail', () => {
			it('non Admin can not set associated market.', async () => {
				const markets = await init()
				const signers = await getSigners()
				for (const market of markets) {
					await expect(
						market.setAssociatedMarket(signers.associatedMarket.address)
					).to.be.revertedWith('illegal sender')
				}
			})
		})
	})

	describe('setAssociatedMarket', () => {
		describe('success', () => {
			it('set prior approval mode.', async () => {
				const [marketBehavior] = await init()
				expect(await marketBehavior.priorApproval()).to.be.equal(true)
				await marketBehavior.setPriorApprovalMode(false)
				expect(await marketBehavior.priorApproval()).to.be.equal(false)
				await marketBehavior.setPriorApprovalMode(true)
				expect(await marketBehavior.priorApproval()).to.be.equal(true)
			})
		})
		describe('fail', () => {
			it('non Admin can not add operator role.', async () => {
				const [, marketOperator, marketKhaos, marketuser] = await init()
				for (const market of [marketOperator, marketKhaos, marketuser]) {
					await expect(market.setPriorApprovalMode(false)).to.be.reverted
				}
			})
		})
	})

	// Describe("pause,unpause", () => {
	//   describe("success", () => {
	//     it("Non-authentication-related functions can be executed in the pause state.", async () => {
	// 	const [marketBehavior] = await init()
	// 	const [, operator, khaos] = await ethers.getSigners()
	//       await marketBehavior.pause();
	//       await marketBehavior.setPriorApprovalMode(false);
	//       await marketBehavior.addPublicSignaturee("dummy-sig");
	//       await marketBehavior.setOperator(operator.address);
	//       await marketBehavior.setKhaos(khaos.address);
	//       await marketBehavior.setAssociatedMarket(khaos.address);
	//       await marketBehavior.schema();
	//       await marketBehavior.getId(metrics.address);
	//       await marketBehavior.getMetrics("user/repo");
	//     });
	//     it("When the pause is released, the authentication function can be executed", async () => {
	//       await marketBehavior.pause();
	//       await marketBehavior.unpause();
	//       await marketBehavior.setPriorApprovalMode(true);
	//       await marketBehavior.setAssociatedMarket(wallet.address);
	//       await marketBehavior.addPublicSignaturee("dummy-signature");
	//       await marketBehavior.authenticate(
	//         property1.address,
	//         "user/repository",
	//         "dummy-signature",
	//         "",
	//         "",
	//         "",
	//         market.address,
	//         ethers.constants.AddressZero
	//       );
	//       const marketBehaviorKhaos = marketBehavior.connect(khaos);
	//       await marketBehavior.setKhaos(khaos.address);
	//       await expect(
	//         marketBehaviorKhaos.khaosCallback("user/repository", 0, "success")
	//       )
	//         .to.emit(marketBehavior, "Authenticated")
	//         .withArgs("user/repository", 0, "success");
	//       expect(await marketBehavior.getId(metrics.address)).to.equal(
	//         "user/repository"
	//       );
	//       expect(await marketBehavior.getMetrics("user/repository")).to.equal(
	//         metrics.address
	//       );
	//     });
	//     it("Non-authentication-related functions will continue to execute after pause is released", async () => {
	//       await marketBehavior.pause();
	//       await marketBehavior.unpause();
	//       await marketBehavior.setPriorApprovalMode(false);
	//       await marketBehavior.addPublicSignaturee("dummy-sig");
	//       await marketBehavior.setOperator(operator.address);
	//       await marketBehavior.setKhaos(khaos.address);
	//       await marketBehavior.setAssociatedMarket(khaos.address);
	//       await marketBehavior.schema();
	//       await marketBehavior.getId(metrics.address);
	//       await marketBehavior.getMetrics("user/repo");
	//     });
	//   });
	//   describe("fail", () => {
	//     it("Can't pause during pause.", async () => {
	//       await marketBehavior.pause();
	//       await expect(marketBehavior.pause()).to.be.revertedWith(
	//         "Pausable: paused"
	//       );
	//     });
	//     it("Authentication is not possible during pause.", async () => {
	//       await marketBehavior.pause();
	//       await marketBehavior.setPriorApprovalMode(false);
	//       await marketBehavior.setAssociatedMarket(wallet.address);
	//       await expect(
	//         marketBehavior.authenticate(
	//           property1.address,
	//           "user/repository",
	//           "dummy-signature",
	//           "",
	//           "",
	//           "",
	//           market.address,
	//           wallet.address
	//         )
	//       ).to.be.revertedWith("Pausable: paused");
	//     });
	//     it("The callback function cannot be executed during pause.", async () => {
	//       await marketBehavior.pause();
	//       await expect(
	//         marketBehavior.khaosCallback("user/repository", 0, "success")
	//       ).to.be.revertedWith("Pausable: paused");
	//     });
	//     it("You can't unpause when you're not on pause.", async () => {
	//       await expect(marketBehavior.unpause()).to.be.revertedWith(
	//         "Pausable: not paused"
	//       );
	//     });
	//     it("Can't unpause while unpausing", async () => {
	//       await marketBehavior.pause();
	//       await marketBehavior.unpause();
	//       await expect(marketBehavior.unpause()).to.be.revertedWith(
	//         "Pausable: not paused"
	//       );
	//     });
	//     it("Only the deployer can pause.", async () => {
	//       const marketBehaviorKhaos = marketBehavior.connect(khaos);
	//       await expect(marketBehaviorKhaos.pause()).to.be.revertedWith(
	//         "Ownable: caller is not the owner"
	//       );
	//     });
	//     it("Only the deployer can unpause.", async () => {
	//       await marketBehavior.pause();
	//       const marketBehaviorKhaos = marketBehavior.connect(khaos);
	//       await expect(marketBehaviorKhaos.unpause()).to.be.revertedWith(
	//         "Ownable: caller is not the owner"
	//       );
	//     });
	//   });
	// });

	describe('authenticate', () => {
		const init2 = async (): Promise<
			[
				GitHubMarket,
				GitHubMarket,
				GitHubMarket,
				GitHubMarket,
				GitHubMarket,
				GitHubMarket
			]
		> => {
			const markets = await init()
			const signers = await getSigners()
			await markets[5].setAssociatedMarket(signers.associatedMarket.address)
			return markets
		}

		describe('success', () => {
			describe('prior approved mode', () => {
				it('Query event data is created.', async () => {
					const [marketBehaviorAdmin, , , , marketByAssociate] = await init2()
					await marketBehaviorAdmin.setPriorApprovalMode(true)
					await marketBehaviorAdmin.addPublicSignaturee('dummy-signature')
					const property = provider.createEmptyWallet()
					const signers = await getSigners()
					await expect(
						marketByAssociate.authenticate(
							property.address,
							['user/repository', 'dummy-signature'],
							signers.user.address
						)
					)
						.to.emit(marketByAssociate, 'Query')
						.withArgs(
							'user/repository',
							'dummy-signature',
							signers.user.address
						)
				})
			})

			// Describe("prior approved mode", () => {
			//   it("Query event data is created.", async () => {
			// 		const
			//     await marketBehavior.setPriorApprovalMode(true);
			//     await marketBehavior.setAssociatedMarket(wallet.address);
			//     await marketBehavior.addPublicSignaturee("dummy-signature");
			//     await expect(
			//       marketBehavior.authenticate(
			//         property1.address,
			//         "user/repository",
			//         "dummy-signature",
			//         "",
			//         "",
			//         "",
			//         market.address,
			//         wallet.address
			//       )
			//     )
			//       .to.emit(marketBehavior, "Query")
			//       .withArgs("user/repository", "dummy-signature", wallet.address);
			//   });
			//   it("You can also authenticate with a public key set by the operator.", async () => {
			//     await marketBehavior.setPriorApprovalMode(true);
			//     await marketBehavior.setAssociatedMarket(wallet.address);
			//     await marketBehavior.setOperator(operator.address);
			//     const marketBehaviorOperator = marketBehavior.connect(operator);
			//     await marketBehaviorOperator.addPublicSignaturee(
			//       "dummy-signature-second",
			//       {
			//         gasLimit: 1000000,
			//       }
			//     );
			//     await expect(
			//       marketBehavior.authenticate(
			//         property1.address,
			//         "user/repository",
			//         "dummy-signature-second",
			//         "",
			//         "",
			//         "",
			//         market.address,
			//         wallet.address
			//       )
			//     )
			//       .to.emit(marketBehavior, "Query")
			//       .withArgs(
			//         "user/repository",
			//         "dummy-signature-second",
			//         wallet.address
			//       );
			//   });
			// });
			// describe("not prior approved mode", () => {
			//   it("Query event data is created.", async () => {
			//     await marketBehavior.setPriorApprovalMode(false);
			//     await marketBehavior.setAssociatedMarket(wallet.address);
			//     await expect(
			//       marketBehavior.authenticate(
			//         property1.address,
			//         "user/repository",
			//         "dummy-signature",
			//         "",
			//         "",
			//         "",
			//         market.address,
			//         wallet.address
			//       )
			//     )
			//       .to.emit(marketBehavior, "Query")
			//       .withArgs("user/repository", "dummy-signature", wallet.address);
			//   });
			// });
		})
		// Describe("fail", () => {
		//   it("Not prior approved when in prior approval mode.", async () => {
		//     await marketBehavior.setPriorApprovalMode(true);
		//     await marketBehavior.setAssociatedMarket(wallet.address);
		//     await expect(
		//       marketBehavior.authenticate(
		//         property1.address,
		//         "user/repository",
		//         "dummy-signature",
		//         "",
		//         "",
		//         "",
		//         market.address,
		//         ethers.constants.AddressZero
		//       )
		//     ).to.be.revertedWith("it has not been approved");
		//   });
		//   it("Sender is not Associated-Market.", async () => {
		//     await marketBehavior.setPriorApprovalMode(true);
		//     await marketBehavior.setAssociatedMarket(khaos.address);
		//     await expect(
		//       marketBehavior.authenticate(
		//         property1.address,
		//         "user/repository",
		//         "dummy-signature",
		//         "",
		//         "",
		//         "",
		//         market.address,
		//         ethers.constants.AddressZero
		//       )
		//     ).to.be.revertedWith("Invalid sender");
		//   });
		// });
	})

	// Describe("khaosCallback", () => {
	//   describe("success", () => {
	//     it("The authentication is completed when the callback function is executed from khaos.", async () => {
	//       await marketBehavior.setPriorApprovalMode(true);
	//       await marketBehavior.setAssociatedMarket(wallet.address);
	//       await marketBehavior.addPublicSignaturee("dummy-signature");
	//       await marketBehavior.authenticate(
	//         property1.address,
	//         "user/repository",
	//         "dummy-signature",
	//         "",
	//         "",
	//         "",
	//         market.address,
	//         ethers.constants.AddressZero
	//       );
	//       const marketBehaviorKhaos = marketBehavior.connect(khaos);
	//       await marketBehavior.setKhaos(khaos.address);
	//       await expect(
	//         marketBehaviorKhaos.khaosCallback("user/repository", 0, "success")
	//       )
	//         .to.emit(marketBehavior, "Authenticated")
	//         .withArgs("user/repository", 0, "success");
	//       expect(await marketBehavior.getId(metrics.address)).to.equal(
	//         "user/repository"
	//       );
	//       expect(await marketBehavior.getMetrics("user/repository")).to.equal(
	//         metrics.address
	//       );
	//     });
	//   });
	//   describe("fail", () => {
	//     it("If you don't set the khaos address, you'll get an error", async () => {
	//       await expect(
	//         marketBehavior.khaosCallback("user/repository", 0, "success")
	//       ).to.be.revertedWith("illegal access");
	//     });
	//     it("If the authentication is not in progress, an error occurs.", async () => {
	//       const marketBehaviorKhaos = marketBehavior.connect(khaos);
	//       await marketBehavior.setKhaos(khaos.address);
	//       await expect(
	//         marketBehaviorKhaos.khaosCallback("user/repository", 0, "success")
	//       ).to.be.revertedWith("not while pending");
	//     });
	//     it("An error occurs during authentication.", async () => {
	//       await marketBehavior.setPriorApprovalMode(true);
	//       await marketBehavior.setAssociatedMarket(wallet.address);
	//       await marketBehavior.addPublicSignaturee("dummy-signature");
	//       await marketBehavior.authenticate(
	//         property1.address,
	//         "user/repository",
	//         "dummy-signature",
	//         "",
	//         "",
	//         "",
	//         market.address,
	//         ethers.constants.AddressZero
	//       );
	//       const marketBehaviorKhaos = marketBehavior.connect(khaos);
	//       await marketBehavior.setKhaos(khaos.address);
	//       await expect(
	//         marketBehaviorKhaos.khaosCallback(
	//           "user/repository",
	//           1,
	//           "test error messaage"
	//         )
	//       ).to.be.revertedWith("test error messaage");
	//     });
	//   });
	// });
})

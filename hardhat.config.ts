
/**
 * @type import('hardhat/config').HardhatUserConfig
 */
import '@typechain/hardhat'
import '@nomiclabs/hardhat-ethers'
import '@nomiclabs/hardhat-waffle'
import { HardhatUserConfig } from "hardhat/config";

const infuraKey = ''
const mnemonic = ''

const config: HardhatUserConfig = {
	solidity:{
		version: "0.8.4",
		settings: {
		  optimizer: {
			enabled: true,
			runs: 200
		  }
		}
	},
	networks: {
		arbitrumRinkeby: {
		  url: 'https://arbitrum-rinkeby.infura.io/v3/' + infuraKey,
		  accounts: {
			mnemonic
		  }
		},
	  },
};

export default config

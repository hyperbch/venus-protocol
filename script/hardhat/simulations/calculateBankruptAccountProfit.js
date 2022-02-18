// npx hardhat run script/hardhat/simulations/nextComptrollerUpgrade.js

const { expect, web3 } = require('hardhat');
const BigNumber = require('bignumber.js');
const fs = require('fs');
const { deploy, getContractAt, impersonate, mergeInterface } = require('../utils/misc');
const { Contracts: 
    {
        XVS: xvsAddress,
        vBNB: vBnbAddress,
        Unitroller: comptrollerProxyAddress,
        VaiUnitroller: vaiControllerProxyAddress,
        Timelock: timelockAddress,
    }
} = require('../../../networks/mainnet.json');

async function upgradeNextComptroller() {
    const deployerAddress = '0x55A9f5374Af30E3045FB491f1da3C2E8a74d168D';
    const btcBankruptor = '0xEF044206Db68E40520BfA82D45419d498b4bc7Bf';

    await impersonate(btcBankruptor);
    await impersonate(deployerAddress);

    const comptrollerContract = getContractAt('Comptroller', comptrollerProxyAddress);
    const xvsContract = getContractAt('XVS', xvsAddress);

    console.log('claim venus, before xvs balance:', await xvsContract.methods.balanceOf(btcBankruptor).call());
    await comptrollerContract.methods.claimVenus(btcBankruptor).send({
        from: btcBankruptor,
    });

    console.log('claim venus, after xvs balance:', await xvsContract.methods.balanceOf(btcBankruptor).call());

}

upgradeNextComptroller()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
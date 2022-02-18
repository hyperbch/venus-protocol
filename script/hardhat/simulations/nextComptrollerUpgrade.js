// npx hardhat run script/hardhat/simulations/nextComptrollerUpgrade.js

const { expect, web3 } = require('hardhat');
const BigNumber = require('bignumber.js');
const fs = require('fs');
const { deploy, getContractAt, impersonate, mergeInterface } = require('../utils/misc');
const { Contracts: 
    {
        vBNB: vBnbAddress,
        Unitroller: comptrollerProxyAddress,
        VaiUnitroller: vaiControllerProxyAddress,
        Timelock: timelockAddress,
    }
} = require('../../../networks/mainnet.json');

const guy = '0x5C0540deee67Bf6584Ede790D3147E076aEe78cb';

async function VIP1(
    comptrollerProxyContract,
    vaiControllerProxyContract,
    comptrollerWithLiquidationInterfaceImpl,
    vaiControllerImpl,
    comptrollerLensContract,
    timelockAddress,
) {
    console.log(`>>>>>>>>>> Executing the first VIP: Updating comptroller with all the updates, but liquidation interface is kept <<<<<<<<<<`)
    console.log('Setting Pending impl of Unitroller')
    await comptrollerProxyContract.methods._setPendingImplementation(comptrollerWithLiquidationInterfaceImpl._address).send({
        from: timelockAddress,
    });
    console.log('Pending comptroller becomes the impl')
    await comptrollerWithLiquidationInterfaceImpl.methods._become(comptrollerProxyContract._address).send({
        from: timelockAddress,
    });
    console.log('Setting the ComptrollerLens contract address')
    await comptrollerProxyContract.methods._setComptrollerLens(comptrollerLensContract._address).send({
        from: timelockAddress,
    });
    console.log('Setting Pending impl of VAIUnitroller')
    await vaiControllerProxyContract.methods._setPendingImplementation(vaiControllerImpl._address).send({
        from: timelockAddress,
    });
    console.log('Pending VAIController becomes the impl')
    await vaiControllerImpl.methods._become(vaiControllerProxyContract._address).send({
        from: timelockAddress,
    });
    console.log('First VIP executed!')
}

async function VIP2(
    comptrollerProxyContract,
    finalComptrollerImpl,
    liquidatorContract,
    timelockAddress,
) {
    console.log(`>>>>>>>>>> Executing the second VIP: Updating comptroller with restricted liquidation interface <<<<<<<<<<<`)
    console.log('Setting Pending impl of Unitroller')
    await comptrollerProxyContract.methods._setPendingImplementation(finalComptrollerImpl._address).send({
        from: timelockAddress,
    });
    console.log('Pending comptroller becomes the impl')
    await finalComptrollerImpl.methods._become(comptrollerProxyContract._address).send({
        from: timelockAddress,
    });
    console.log('Set liquidator contract')
    await comptrollerProxyContract.methods._setLiquidatorContract(liquidatorContract._address).send({
        from: timelockAddress,
    });
    console.log('Second VIP executed!')
}

async function dealWithBankruptAccount(account, comptrollerProxyContract) {
    console.log(`>>>>>>>>>> Start dealing with bankrupt account: ${account} <<<<<<<<<<`);

    console.log(`Before claim as collateral, liquidity & shortfall`, await comptrollerProxyContract.methods.getAccountLiquidity(account).call());

    console.log(`Try claimVenus XVS rewards for ${account}`);
    try {
        await comptrollerProxyContract.methods.claimVenus(account).send({
            from: guy,
        })
        expect(false, 'Claim venus for bankrupt account should failed');
        exit(1);
    }
    catch (e) {
        console.log('claim venus failed as expected!');
        expect(e.message).equal(`VM Exception while processing transaction: reverted with reason string 'bankrupt accounts can only collateralize their pending xvs rewards'`)
    }

    // 2. claim their reward as collateral on their behalf
    console.log(`Start claimVenusAsCollateral XVS rewards for ${account}, they gon feel the pain!`);
    await comptrollerProxyContract.methods.claimVenusAsCollateral(account).send({
        from: guy,
    });

    console.log(`After claim as collateral, liquidity & shortfall`, await comptrollerProxyContract.methods.getAccountLiquidity(account).call());
    
}

async function liquidateAccount(account, comptrollerProxyContract) {
    
}

async function upgradeNextComptroller() {
    const deployerAddress = '0x55A9f5374Af30E3045FB491f1da3C2E8a74d168D';

    await impersonate(guy);
    await impersonate(deployerAddress);
    await impersonate(timelockAddress);

    //
    console.log('>>>>>>>>>> prepare proxy contracts <<<<<<<<<<')
    const comptrollerProxyContract = getContractAt('Unitroller', comptrollerProxyAddress);
    mergeInterface(comptrollerProxyContract, getContractAt('Comptroller', comptrollerProxyAddress));

    const vaiControllerProxyContract = getContractAt('VAIUnitroller', vaiControllerProxyAddress);
    mergeInterface(vaiControllerProxyContract, getContractAt('VAIController', vaiControllerProxyAddress));

    //
    console.log('>>>>>>>>>> Deploying all necessary contract <<<<<<<<<<')
    console.log('Deploying ComptrollerLens...');
    const comptrollerLensContract = await deploy('ComptrollerLens').send({ from: deployerAddress });
    console.log(`Deployed ComptrollerLens to ${comptrollerLensContract._address}`);

    console.log('Deploying updated Comptroller Impl, which still possesses public liquidation interface...');
    const comptrollerWithLiquidationInterfaceImpl = await deploy('ComptrollerLiquidationPublic').send({ from: deployerAddress });
    console.log(`Deployed updated Comptroller Impl to ${comptrollerWithLiquidationInterfaceImpl._address}`);

    console.log('Deploying new Comptroller Impl...');
    const finalComptrollerImpl = await deploy('Comptroller').send({ from: deployerAddress });
    console.log(`Deployed new Comptroller Impl to ${finalComptrollerImpl._address}`);

    console.log('Deploying VAIController Impl...');
    const vaiControllerImpl = await deploy('VAIController').send({ from: deployerAddress });
    console.log(`Deployed VAIController Impl to ${vaiControllerImpl._address}`);

    const treasuryAddress = await comptrollerProxyContract.methods.treasuryAddress().call();
    const adminAddress = await comptrollerProxyContract.methods.admin().call();
    console.log(`>>>>>>>>>> Deploying Liquidator, treasury address: ${treasuryAddress}, adminAddress: ${adminAddress} <<<<<<<<<<<`);
    const liquidatorContract = await deploy(
        'VAIController',
        adminAddress,
        vBnbAddress,
        comptrollerProxyContract._address,
        vaiControllerProxyContract._address,
        treasuryAddress,
        new BigNumber(0.05).times(10^18),
    ).send({ from: deployerAddress });
    console.log(`Deployed Liquidator to ${liquidatorContract._address}`);
    
    await VIP1(
        comptrollerProxyContract,
        vaiControllerProxyContract,
        comptrollerWithLiquidationInterfaceImpl,
        vaiControllerImpl,
        comptrollerLensContract,
        timelockAddress,
    );

    // test
    // 1. bankrupt account can't claim their fund
    // await dealWithBankruptAccount('0x7589dD3355DAE848FDbF75044A3495351655cB1A', comptrollerProxyContract);
    // 1900 BTC 
    await dealWithBankruptAccount('0xEF044206Db68E40520BfA82D45419d498b4bc7Bf', comptrollerProxyContract);
    
    // await VIP2(
    //     comptrollerProxyContract,
    //     finalComptrollerImpl,
    //     liquidatorContract,
    //     timelockAddress,
    // );

    // test
    // 1. liquidators can only work with Liquidator Contract
}

upgradeNextComptroller()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
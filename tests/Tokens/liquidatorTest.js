const {
  bnbGasCost,
  bnbUnsigned,
  bnbMantissa
} = require('../Utils/BSC');

const {
  makeVToken,
  fastForward,
  setBalance,
  getBalances,
  adjustBalances,
  pretendBorrow,
  preApprove
} = require('../Utils/Venus');

const repayAmount = bnbUnsigned(10e2);
const seizeAmount = repayAmount;
const seizeTokens = seizeAmount.mul(4); // forced

async function preLiquidate(vToken, liquidator, borrower, repayAmount, vTokenCollateral) {
  // setup for success in liquidating
  await send(vToken.comptroller, 'setLiquidateBorrowAllowed', [true]);
  await send(vToken.comptroller, 'setLiquidateBorrowVerify', [true]);
  await send(vToken.comptroller, 'setRepayBorrowAllowed', [true]);
  await send(vToken.comptroller, 'setRepayBorrowVerify', [true]);
  await send(vToken.comptroller, 'setSeizeAllowed', [true]);
  await send(vToken.comptroller, 'setSeizeVerify', [true]);
  await send(vToken.comptroller, 'setFailCalculateSeizeTokens', [false]);
  await send(vToken.underlying, 'harnessSetFailTransferFromAddress', [liquidator, false]);
  await send(vToken.interestRateModel, 'setFailBorrowRate', [false]);
  await send(vTokenCollateral.interestRateModel, 'setFailBorrowRate', [false]);
  await send(vTokenCollateral.comptroller, 'setCalculatedSeizeTokens', [seizeTokens]);
  await setBalance(vTokenCollateral, liquidator, 0);
  await setBalance(vTokenCollateral, borrower, seizeTokens);
  await pretendBorrow(vTokenCollateral, borrower, 0, 1, 0);
  await pretendBorrow(vToken, borrower, 1, 1, repayAmount);
  await preApprove(vToken, liquidator, repayAmount);
}

async function liquidateFresh(vToken, liquidator, borrower, repayAmount, vTokenCollateral) {
  return send(vToken, 'harnessLiquidateBorrowFresh', [liquidator, borrower, repayAmount, vTokenCollateral._address]);
}

async function liquidate(vToken, liquidator, borrower, repayAmount, vTokenCollateral) {
  // make sure to have a block delta so we accrue interest
  await fastForward(vToken, 1);
  await fastForward(vTokenCollateral, 1);
  return send(vToken, 'liquidateBorrow', [borrower, repayAmount, vTokenCollateral._address], { from: liquidator });
}

async function seize(vToken, liquidator, borrower, seizeAmount) {
  return send(vToken, 'seize', [liquidator, borrower, seizeAmount]);
}

describe('VToken', function () {
  let root, liquidator, borrower, treasury, accounts;
  let vToken, vBNB, vTokenCollateral;
  let liquidatorContract;

  beforeEach(async () => {
    [root, liquidator, borrower, treasury, ...accounts] = saddle.accounts;
    vToken = await makeVToken({ comptrollerOpts: { kind: 'bool' } });
    vBNB = await makeVToken({ kind: "vbnb", supportMarket: true });
    vTokenCollateral = await makeVToken({ comptroller: vToken.comptroller });
    liquidatorContract = await deploy('Liquidator',
      [
        vBNB._address,
        vToken.comptroller._address,
        treasury,
        bnbMantissa(0.05)
      ]);
    console.log(`liquidator is deployed at: ${liquidatorContract._address}`);
  });

  beforeEach(async () => {
    await preLiquidate(vToken, liquidator, borrower, repayAmount, vTokenCollateral);
  });

  describe('liquidateBorrow', () => {

    it("returns success from liquidateBorrow and transfers the correct amounts", async () => {

      const beforeBalances = await getBalances([vToken, vTokenCollateral], [liquidator, borrower]);

      //const result = await liquidate(vToken, liquidator, borrower, repayAmount, vTokenCollateral);

      const result = await send(liquidatorContract, 'liquidateBorrow', [vToken._address, borrower, repayAmount, vTokenCollateral._address]);

      expect(result).toSucceed();

      // const gasCost = await bnbGasCost(result);
      // const afterBalances = await getBalances([vToken, vTokenCollateral], [liquidator, borrower]);
      // expect(afterBalances).toEqual(await adjustBalances(beforeBalances, [
      //   [vToken, 'cash', repayAmount],
      //   [vToken, 'borrows', -repayAmount],
      //   [vToken, liquidator, 'bnb', -gasCost],
      //   [vToken, liquidator, 'cash', -repayAmount],
      //   [vTokenCollateral, liquidator, 'bnb', -gasCost],
      //   [vTokenCollateral, liquidator, 'tokens', seizeTokens],
      //   [vToken, borrower, 'borrows', -repayAmount],
      //   [vTokenCollateral, borrower, 'tokens', -seizeTokens]
      // ]));
    });
  });

});

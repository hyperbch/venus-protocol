const {
  bnbUnsigned,
  bnbMantissa
} = require('../Utils/BSC');
const { dfn } = require('../Utils/JS');
const {
  makeVToken,
} = require('../Utils/Venus');

const repayAmount = bnbUnsigned(10e2);
const seizeAmount = repayAmount;
const seizeTokens = seizeAmount.mul(4); // forced
const announcedIncentive = bnbMantissa('1.10');
const treasuryPercent = bnbMantissa('0.05');

function calculateSplitSeizedTokens(amount) {
  const treasuryDelta =
    amount
      .mul(bnbMantissa('1')).div(announcedIncentive) // / 1.1
      .mul(treasuryPercent).div(bnbMantissa('1'));   // * 0.05
  const liquidatorDelta = amount.sub(treasuryDelta);
  return { treasuryDelta, liquidatorDelta };
}

describe('Liquidator', function () {
  let root, liquidator, borrower, treasury, accounts;
  let vToken, vTokenCollateral, liquidatorContract, vBnb;

  beforeEach(async () => {
    [root, liquidator, borrower, treasury, ...accounts] = saddle.accounts;
    vToken = await makeVToken({ comptrollerOpts: { kind: 'bool' } });
    vTokenCollateral = await makeVToken({ comptroller: vToken.comptroller });
    vBnb = await makeVToken({ kind: 'vbnb', comptroller: vToken.comptroller });
    liquidatorContract = await deploy(
      'LiquidatorHarness', [
      root,
      vBnb._address,
      vToken.comptroller._address,
      treasury,
      treasuryPercent
    ]
    );
  });

  describe('splitLiquidationIncentive', () => {

    it('split liquidationIncentive between Treasury and Liquidator with correct amounts', async () => {
     
    });

  });

  describe('distributeLiquidationIncentive', () => {

    it('distribute the liquidationIncentive between Treasury and Liquidator with correct amounts', async () => {
     
    });

  });

});
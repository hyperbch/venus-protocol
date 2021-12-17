pragma solidity ^0.5.16;

import "../../contracts/Liquidator.sol";
import "./ComptrollerScenario.sol";

contract LiquidatorHarness is Liquidator {

    constructor(
        address admin_,
        address payable vBnb_,
        address comptroller_,
        address treasury_,
        uint256 treasuryPercentMantissa_
    )
        public
        Liquidator(
            admin_,
            vBnb_,
            comptroller_,
            treasury_,
            treasuryPercentMantissa_
        )
    {}

    event DistributeLiquidationIncentive(uint256 seizeTokensForTreasury, uint256 seizeTokensForLiquidator);


    /// @dev Splits the received vTokens between the liquidator and treasury.
    function distributeLiquidationIncentive(
        VToken vTokenCollateral,
        uint256 siezedAmount
    ) public returns (uint256 ours, uint256 theirs) {
        (ours, theirs) = _splitLiquidationIncentive(siezedAmount);
        require(
            vTokenCollateral.transfer(msg.sender, theirs),
            "failed to transfer to liquidator"
        );
        require(
            vTokenCollateral.transfer(treasury, ours),
            "failed to transfer to treasury"
        );
        emit DistributeLiquidationIncentive(ours, theirs);
        return (ours, theirs);
    }

    /// @dev Computes the amounts that would go to treasury and to the liquidator.
    function splitLiquidationIncentive(uint256 seizedAmount)
        public
        view
        returns (uint256 ours, uint256 theirs)
    {
        uint256 totalIncentive = comptroller.liquidationIncentiveMantissa();
        uint256 seizedForRepayment = seizedAmount.mul(1e18).div(totalIncentive);
        ours = seizedForRepayment.mul(treasuryPercentMantissa).div(1e18);
        theirs = seizedAmount.sub(ours);
        return (ours, theirs);
    }
}

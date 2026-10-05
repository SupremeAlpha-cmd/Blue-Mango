// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/BlueMango.sol";

contract MockUSDG {
    string public name = "Mock USDG";
    string public symbol = "mUSDG";
    uint8 public decimals = 6;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function mint(address to, uint256 amt) external {
        balanceOf[to] += amt;
    }

    function approve(address sp, uint256 amt) external returns (bool) {
        allowance[msg.sender][sp] = amt;
        return true;
    }

    function transfer(address to, uint256 amt) external returns (bool) {
        require(balanceOf[msg.sender] >= amt, "bal");
        balanceOf[msg.sender] -= amt;
        balanceOf[to] += amt;
        return true;
    }

    function transferFrom(address from, address to, uint256 amt) external returns (bool) {
        require(balanceOf[from] >= amt, "bal");
        require(allowance[from][msg.sender] >= amt, "allow");
        allowance[from][msg.sender] -= amt;
        balanceOf[from] -= amt;
        balanceOf[to] += amt;
        return true;
    }
}

contract BlueMangoTest is Test {
    MockUSDG usdg;
    BlueMango bm;

    address payer = address(0xA11CE);
    address payee = address(0xB0B);
    address arbiter = address(0xA2817E2);
    address stranger = address(0xDEAD);

    string[] descs;
    uint256[] amounts; // 100, 200, 300 => total 600

    function setUp() public {
        usdg = new MockUSDG();
        bm = new BlueMango(address(usdg));
        usdg.mint(payer, 10_000);

        descs.push("Design");
        descs.push("Build");
        descs.push("Launch");
        amounts.push(100);
        amounts.push(200);
        amounts.push(300);
    }

    function _createDeal() internal returns (uint256) {
        vm.startPrank(payer);
        usdg.approve(address(bm), 600);
        uint256 id = bm.createDeal(payee, arbiter, descs, amounts, 600);
        vm.stopPrank();
        return id;
    }

    // ── creation ──────────────────────────────────────────────────────

    function testCreateDealFundsContract() public {
        uint256 id = _createDeal();
        (address p, address pe, address a, uint256 total, uint256 released, uint256 refunded, uint256 n) = bm.getDeal(id);
        assertEq(p, payer);
        assertEq(pe, payee);
        assertEq(a, arbiter);
        assertEq(total, 600);
        assertEq(released, 0);
        assertEq(refunded, 0);
        assertEq(n, 3);
        assertEq(usdg.balanceOf(address(bm)), 600);
        assertEq(usdg.balanceOf(payer), 10_000 - 600);
    }

    function testCreateDealRevertsOnSumMismatch() public {
        vm.startPrank(payer);
        usdg.approve(address(bm), 600);
        vm.expectRevert("sum != total");
        bm.createDeal(payee, arbiter, descs, amounts, 599);
        vm.stopPrank();
    }

    function testCreateDealRevertsOnZeroAmount() public {
        uint256[] memory bad = new uint256[](2);
        bad[0] = 100;
        bad[1] = 0;
        string[] memory d = new string[](2);
        d[0] = "a";
        d[1] = "b";
        vm.startPrank(payer);
        vm.expectRevert("amount zero");
        bm.createDeal(payee, arbiter, d, bad, 100);
        vm.stopPrank();
    }

    function testCreateDealRevertsWhenPayerIsPayee() public {
        vm.startPrank(payer);
        vm.expectRevert("payer==payee");
        bm.createDeal(payer, arbiter, descs, amounts, 600);
        vm.stopPrank();
    }

    function testCreateDealRevertsWhenArbiterNotNeutral() public {
        vm.startPrank(payer);
        vm.expectRevert("arbiter not neutral");
        bm.createDeal(payee, payer, descs, amounts, 600);
        vm.stopPrank();
    }

    // ── happy paths ───────────────────────────────────────────────────

    function testHappyPathFullRelease() public {
        uint256 id = _createDeal();
        for (uint256 i = 0; i < 3; i++) {
            vm.prank(payee);
            bm.markDone(id, i);
            vm.prank(payer);
            bm.approveMilestone(id, i);
        }
        assertEq(usdg.balanceOf(payee), 600);
        assertEq(usdg.balanceOf(address(bm)), 0);
        (,,,, uint256 released,,) = bm.getDeal(id);
        assertEq(released, 600);
    }

    function testPartialMilestoneRelease() public {
        uint256 id = _createDeal();
        vm.prank(payee);
        bm.markDone(id, 0);
        vm.prank(payer);
        bm.approveMilestone(id, 0);
        assertEq(usdg.balanceOf(payee), 100);
        assertEq(usdg.balanceOf(address(bm)), 500);
        (string memory desc, uint256 amt, BlueMango.MilestoneState st,) = bm.getMilestone(id, 0);
        assertEq(uint256(st), uint256(BlueMango.MilestoneState.Released));
        assertEq(amt, 100);
        assertEq(desc, "Design");
        // milestone 1 still pending
        (,, BlueMango.MilestoneState st1,) = bm.getMilestone(id, 1);
        assertEq(uint256(st1), uint256(BlueMango.MilestoneState.Pending));
    }

    // ── timeout claim ─────────────────────────────────────────────────

    function testPayeeCanClaimAfterTimeout() public {
        uint256 id = _createDeal();
        vm.prank(payee);
        bm.markDone(id, 1);
        vm.warp(block.timestamp + 7 days + 1);
        vm.prank(payee);
        bm.claimMilestone(id, 1);
        assertEq(usdg.balanceOf(payee), 200);
    }

    function testClaimRevertsBeforeTimeout() public {
        uint256 id = _createDeal();
        vm.prank(payee);
        bm.markDone(id, 1);
        vm.warp(block.timestamp + 6 days);
        vm.prank(payee);
        vm.expectRevert("too early");
        bm.claimMilestone(id, 1);
    }

    // ── disputes ──────────────────────────────────────────────────────

    function testDisputeResolvedToPayee() public {
        uint256 id = _createDeal();
        vm.prank(payee);
        bm.markDone(id, 2);
        vm.prank(payer);
        bm.raiseDispute(id, 2);
        vm.prank(arbiter);
        bm.resolveDispute(id, 2, true);
        assertEq(usdg.balanceOf(payee), 300);
        (,, BlueMango.MilestoneState st,) = bm.getMilestone(id, 2);
        assertEq(uint256(st), uint256(BlueMango.MilestoneState.Released));
    }

    function testDisputeResolvedToPayer() public {
        uint256 id = _createDeal();
        vm.prank(payee);
        bm.markDone(id, 2);
        vm.prank(payee);
        bm.raiseDispute(id, 2);
        vm.prank(arbiter);
        bm.resolveDispute(id, 2, false);
        assertEq(usdg.balanceOf(payer), 10_000 - 600 + 300);
        (,, BlueMango.MilestoneState st,) = bm.getMilestone(id, 2);
        assertEq(uint256(st), uint256(BlueMango.MilestoneState.Refunded));
    }

    function testDisputeRevertsForStranger() public {
        uint256 id = _createDeal();
        vm.prank(payee);
        bm.markDone(id, 0);
        vm.prank(stranger);
        vm.expectRevert("not party");
        bm.raiseDispute(id, 0);
    }

    function testResolveRevertsForNonArbiter() public {
        uint256 id = _createDeal();
        vm.prank(payee);
        bm.markDone(id, 0);
        vm.prank(payer);
        bm.raiseDispute(id, 0);
        vm.prank(stranger);
        vm.expectRevert("not arbiter");
        bm.resolveDispute(id, 0, true);
    }

    function testResolveRevertsWhenNotDisputed() public {
        uint256 id = _createDeal();
        vm.prank(payee);
        bm.markDone(id, 0);
        vm.prank(arbiter);
        vm.expectRevert("not disputed");
        bm.resolveDispute(id, 0, true);
    }

    // ── cancel ────────────────────────────────────────────────────────

    function testCancelRefundsPendingMilestones() public {
        uint256 id = _createDeal();
        // release milestone 0 first
        vm.prank(payee);
        bm.markDone(id, 0);
        vm.prank(payer);
        bm.approveMilestone(id, 0);
        // cancel the rest
        vm.prank(payer);
        bm.cancelRemaining(id);
        assertEq(usdg.balanceOf(payer), 10_000 - 100); // 500 refunded
        assertEq(usdg.balanceOf(payee), 100);
        (,,,,, uint256 refunded,) = bm.getDeal(id);
        assertEq(refunded, 500);
    }

    function testCancelLeavesInFlightMilestones() public {
        uint256 id = _createDeal();
        vm.prank(payee);
        bm.markDone(id, 0); // in-flight, not pending
        vm.prank(payer);
        bm.cancelRemaining(id); // refunds milestones 1,2 only
        assertEq(usdg.balanceOf(payer), 10_000 - 600 + 500);
        (,, BlueMango.MilestoneState st,) = bm.getMilestone(id, 0);
        assertEq(uint256(st), uint256(BlueMango.MilestoneState.Done));
    }

    function testCancelRevertsWhenNothingPending() public {
        uint256 id = _createDeal();
        vm.prank(payee);
        bm.markDone(id, 0);
        vm.prank(payer);
        bm.raiseDispute(id, 0);
        vm.prank(payee);
        bm.markDone(id, 1);
        vm.prank(payee);
        bm.markDone(id, 2);
        vm.prank(payer);
        vm.expectRevert("nothing pending");
        bm.cancelRemaining(id);
    }

    // ── access control / double-spend ─────────────────────────────────

    function testApproveRevertsForNonPayer() public {
        uint256 id = _createDeal();
        vm.prank(payee);
        bm.markDone(id, 0);
        vm.prank(stranger);
        vm.expectRevert("not payer");
        bm.approveMilestone(id, 0);
    }

    function testMarkDoneRevertsForNonPayee() public {
        uint256 id = _createDeal();
        vm.prank(payer);
        vm.expectRevert("not payee");
        bm.markDone(id, 0);
    }

    function testDoubleReleaseReverts() public {
        uint256 id = _createDeal();
        vm.prank(payee);
        bm.markDone(id, 0);
        vm.prank(payer);
        bm.approveMilestone(id, 0);
        vm.prank(payer);
        vm.expectRevert("not done");
        bm.approveMilestone(id, 0);
        assertEq(usdg.balanceOf(payee), 100); // no double pay
    }

    function testApproveRevertsWhenNotDone() public {
        uint256 id = _createDeal();
        vm.prank(payer);
        vm.expectRevert("not done");
        bm.approveMilestone(id, 0);
    }

    function testMarkDoneTwiceReverts() public {
        uint256 id = _createDeal();
        vm.prank(payee);
        bm.markDone(id, 0);
        vm.prank(payee);
        vm.expectRevert("not pending");
        bm.markDone(id, 0);
    }
}

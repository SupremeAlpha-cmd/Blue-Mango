// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title BlueMango — milestone escrow for crypto deals
/// @notice Payer locks USDG upfront for a deal split into milestones.
///         Payee marks each milestone done; payer approves to release funds.
///         If the payer stays silent for 7 days after a milestone is marked
///         done, the payee can claim it. Either side can escalate to the
///         deal's arbiter, who rules per milestone: release to payee or
///         refund to payer. The payer can cancel any milestones that are
///         still pending and get refunded for them.
interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

contract BlueMango {
    /// @notice Silence window after which the payee can claim an approved-by-timeout milestone.
    uint256 public constant CLAIM_TIMEOUT = 7 days;

    enum MilestoneState {
        Pending, // created, waiting for payee to mark done
        Done, // payee marked done, waiting for payer approval / timeout / dispute
        Disputed, // escalated to arbiter
        Released, // funds sent to payee (terminal)
        Refunded // funds returned to payer (terminal)

    }

    struct Milestone {
        string description;
        uint256 amount;
        MilestoneState state;
        uint256 doneAt; // timestamp of markDone; 0 until Done
    }

    struct Deal {
        address payer;
        address payee;
        address arbiter;
        uint256 total; // USDG locked at creation
        uint256 released; // USDG paid out to payee so far
        uint256 refunded; // USDG returned to payer so far
        Milestone[] milestones;
    }

    IERC20 public immutable usdg;
    mapping(uint256 => Deal) private deals;
    uint256 public nextDealId;

    // ── reentrancy guard ──────────────────────────────────────────────
    uint256 private _locked;
    modifier nonReentrant() {
        require(_locked == 0, "reentrant");
        _locked = 1;
        _;
        _locked = 0;
    }

    // ── events ────────────────────────────────────────────────────────
    event DealCreated(
        uint256 indexed dealId, address indexed payer, address indexed payee, address arbiter, uint256 total
    );
    event MilestoneDone(uint256 indexed dealId, uint256 indexed milestoneIdx, uint256 doneAt);
    event MilestoneReleased(uint256 indexed dealId, uint256 indexed milestoneIdx, address indexed to, uint256 amount);
    event MilestoneClaimed(uint256 indexed dealId, uint256 indexed milestoneIdx, uint256 amount);
    event DisputeRaised(uint256 indexed dealId, uint256 indexed milestoneIdx, address indexed by);
    event DisputeResolved(
        uint256 indexed dealId, uint256 indexed milestoneIdx, bool releasedToPayee, uint256 amount
    );
    event MilestoneRefunded(uint256 indexed dealId, uint256 indexed milestoneIdx, uint256 amount);
    event DealCancelled(uint256 indexed dealId, uint256 refundedTotal);

    constructor(address _usdg) {
        require(_usdg != address(0), "zero usdg");
        usdg = IERC20(_usdg);
    }

    // ── deal lifecycle ────────────────────────────────────────────────

    /// @notice Create and fully fund a deal. `total` must equal the exact sum
    ///         of `amounts`, and is pulled from the payer via transferFrom.
    function createDeal(
        address payee,
        address arbiter,
        string[] calldata descriptions,
        uint256[] calldata amounts,
        uint256 total
    ) external nonReentrant returns (uint256) {
        require(payee != address(0) && arbiter != address(0), "zero addr");
        require(payee != msg.sender, "payer==payee");
        require(arbiter != msg.sender && arbiter != payee, "arbiter not neutral");
        require(descriptions.length == amounts.length && amounts.length > 0, "bad milestones");
        require(total > 0, "total zero");

        uint256 sum;
        for (uint256 i = 0; i < amounts.length; i++) {
            require(amounts[i] > 0, "amount zero");
            sum += amounts[i];
        }
        require(sum == total, "sum != total");

        require(usdg.transferFrom(msg.sender, address(this), total), "fund failed");

        uint256 dealId = nextDealId++;
        Deal storage d = deals[dealId];
        d.payer = msg.sender;
        d.payee = payee;
        d.arbiter = arbiter;
        d.total = total;
        for (uint256 i = 0; i < amounts.length; i++) {
            d.milestones.push(Milestone({description: descriptions[i], amount: amounts[i], state: MilestoneState.Pending, doneAt: 0}));
        }

        emit DealCreated(dealId, msg.sender, payee, arbiter, total);
        return dealId;
    }

    /// @notice Payee signals a milestone is complete. Starts the claim clock.
    function markDone(uint256 dealId, uint256 idx) external {
        Deal storage d = deals[dealId];
        require(msg.sender == d.payee, "not payee");
        Milestone storage m = _milestone(d, idx);
        require(m.state == MilestoneState.Pending, "not pending");
        m.state = MilestoneState.Done;
        m.doneAt = block.timestamp;
        emit MilestoneDone(dealId, idx, block.timestamp);
    }

    /// @notice Payer approves a done milestone; USDG goes to the payee.
    function approveMilestone(uint256 dealId, uint256 idx) external nonReentrant {
        Deal storage d = deals[dealId];
        require(msg.sender == d.payer, "not payer");
        Milestone storage m = _milestone(d, idx);
        require(m.state == MilestoneState.Done, "not done");
        m.state = MilestoneState.Released;
        d.released += m.amount;
        require(usdg.transfer(d.payee, m.amount), "pay failed");
        emit MilestoneReleased(dealId, idx, d.payee, m.amount);
    }

    /// @notice Payee claims a milestone the payer ignored for CLAIM_TIMEOUT.
    function claimMilestone(uint256 dealId, uint256 idx) external nonReentrant {
        Deal storage d = deals[dealId];
        require(msg.sender == d.payee, "not payee");
        Milestone storage m = _milestone(d, idx);
        require(m.state == MilestoneState.Done, "not done");
        require(block.timestamp >= m.doneAt + CLAIM_TIMEOUT, "too early");
        m.state = MilestoneState.Released;
        d.released += m.amount;
        require(usdg.transfer(d.payee, m.amount), "pay failed");
        emit MilestoneClaimed(dealId, idx, m.amount);
    }

    /// @notice Either side escalates a done milestone to the arbiter.
    function raiseDispute(uint256 dealId, uint256 idx) external {
        Deal storage d = deals[dealId];
        require(msg.sender == d.payer || msg.sender == d.payee, "not party");
        Milestone storage m = _milestone(d, idx);
        require(m.state == MilestoneState.Done, "not done");
        m.state = MilestoneState.Disputed;
        emit DisputeRaised(dealId, idx, msg.sender);
    }

    /// @notice Arbiter rules on a disputed milestone. Final.
    function resolveDispute(uint256 dealId, uint256 idx, bool releaseToPayee) external nonReentrant {
        Deal storage d = deals[dealId];
        require(msg.sender == d.arbiter, "not arbiter");
        Milestone storage m = _milestone(d, idx);
        require(m.state == MilestoneState.Disputed, "not disputed");
        if (releaseToPayee) {
            m.state = MilestoneState.Released;
            d.released += m.amount;
            require(usdg.transfer(d.payee, m.amount), "pay failed");
        } else {
            m.state = MilestoneState.Refunded;
            d.refunded += m.amount;
            require(usdg.transfer(d.payer, m.amount), "refund failed");
        }
        emit DisputeResolved(dealId, idx, releaseToPayee, m.amount);
    }

    /// @notice Payer refunds every milestone still Pending. In-flight
    ///         (Done/Disputed) milestones are untouched.
    function cancelRemaining(uint256 dealId) external nonReentrant {
        Deal storage d = deals[dealId];
        require(msg.sender == d.payer, "not payer");
        uint256 refundTotal;
        for (uint256 i = 0; i < d.milestones.length; i++) {
            Milestone storage m = d.milestones[i];
            if (m.state == MilestoneState.Pending) {
                m.state = MilestoneState.Refunded;
                refundTotal += m.amount;
                emit MilestoneRefunded(dealId, i, m.amount);
            }
        }
        require(refundTotal > 0, "nothing pending");
        d.refunded += refundTotal;
        require(usdg.transfer(d.payer, refundTotal), "refund failed");
        emit DealCancelled(dealId, refundTotal);
    }

    // ── views ─────────────────────────────────────────────────────────

    function dealCount() external view returns (uint256) {
        return nextDealId;
    }

    function getDeal(uint256 dealId)
        external
        view
        returns (
            address payer,
            address payee,
            address arbiter,
            uint256 total,
            uint256 released,
            uint256 refunded,
            uint256 milestoneCount
        )
    {
        Deal storage d = deals[dealId];
        require(d.payer != address(0), "no deal");
        return (d.payer, d.payee, d.arbiter, d.total, d.released, d.refunded, d.milestones.length);
    }

    function getMilestone(uint256 dealId, uint256 idx)
        external
        view
        returns (string memory description, uint256 amount, MilestoneState state, uint256 doneAt)
    {
        Deal storage d = deals[dealId];
        Milestone storage m = _milestone(d, idx);
        return (m.description, m.amount, m.state, m.doneAt);
    }

    function _milestone(Deal storage d, uint256 idx) internal view returns (Milestone storage) {
        require(d.payer != address(0), "no deal");
        require(idx < d.milestones.length, "bad idx");
        return d.milestones[idx];
    }
}

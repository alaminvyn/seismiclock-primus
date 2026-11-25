// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {IPrimusZKTLS, Attestation} from "./vendor/IPrimusZKTLS.sol";
import {UsgsPolicy} from "./UsgsPolicy.sol";

contract SeismicLock {
    enum State { Unfunded, Funded, Settled, Refunded }

    uint256 public constant CHAIN_ID = 84532;
    uint256 public constant PRINCIPAL = 0.0001 ether;
    uint256 public constant COVERAGE_LIFETIME = 7 days;
    uint256 public constant MAX_PROOF_AGE_MS = 30 minutes * 1000;
    uint256 public constant PROOF_CLOCK_SKEW_MS = 30 seconds * 1000;

    IPrimusZKTLS public immutable verifier;
    address public immutable funder;
    address public immutable beneficiary;
    bytes32 private immutable contextHash;
    State public state;
    uint64 public expiresAt;
    uint64 public fundedAt;

    error WrongChain();
    error InvalidConfiguration();
    error WrongState(State actual);
    error Unauthorized();
    error WrongDeposit();
    error EscrowExpired();
    error EscrowStillActive();
    error WrongRecipient();
    error WrongContext();
    error ProofTimeInvalid();
    error SignatureShapeInvalid();
    error TransferFailed();

    event Funded(address indexed funder, address indexed beneficiary, uint256 amount, uint64 expiresAt);
    event Settled(address indexed beneficiary, uint256 amount, uint256 indexed eventTimeMs, uint256 revisionMs, bytes32 payloadHash);
    event Refunded(address indexed funder, uint256 amount);

    constructor(address verifier_, address funder_, address beneficiary_) {
        if (block.chainid != CHAIN_ID) revert WrongChain();
        if (verifier_.code.length == 0 || funder_ == address(0) || beneficiary_ == address(0)) revert InvalidConfiguration();
        verifier = IPrimusZKTLS(verifier_);
        funder = funder_;
        beneficiary = beneficiary_;
        contextHash = keccak256(bytes(expectedContext()));
    }

    function expectedContext() public view returns (string memory) {
        return string.concat('{"algorithmType":"proxytls","scope":"seismiclock:v1:84532:', Strings.toHexString(address(this)), ':us6000jllz"}');
    }

    function fund() external payable {
        if (state != State.Unfunded) revert WrongState(state);
        if (msg.sender != funder) revert Unauthorized();
        if (msg.value != PRINCIPAL) revert WrongDeposit();
        fundedAt = uint64(block.timestamp);
        expiresAt = uint64(block.timestamp + COVERAGE_LIFETIME);
        state = State.Funded;
        emit Funded(funder, beneficiary, msg.value, expiresAt);
    }

    function preview(Attestation calldata a) external view returns (UsgsPolicy.EventData memory) {
        return check(a);
    }

    function settle(Attestation calldata a) external {
        UsgsPolicy.EventData memory e = check(a);
        state = State.Settled;
        pay(beneficiary);
        emit Settled(beneficiary, PRINCIPAL, e.eventTimeMs, e.revisionMs, keccak256(bytes(a.data)));
    }

    function refund() external {
        if (msg.sender != funder) revert Unauthorized();
        if (state != State.Funded) revert WrongState(state);
        if (block.timestamp < expiresAt) revert EscrowStillActive();
        state = State.Refunded;
        pay(funder);
        emit Refunded(funder, PRINCIPAL);
    }

    function check(Attestation calldata a) private view returns (UsgsPolicy.EventData memory e) {
        if (state != State.Funded) revert WrongState(state);
        if (block.timestamp >= expiresAt) revert EscrowExpired();
        if (a.recipient != beneficiary) revert WrongRecipient();
        if (bytes(a.additionParams).length > 160 || keccak256(bytes(a.additionParams)) != contextHash) revert WrongContext();
        uint256 nowMs = block.timestamp * 1000;
        if (a.timestamp < uint256(fundedAt) * 1000 || a.timestamp + MAX_PROOF_AGE_MS < nowMs
            || a.timestamp > nowMs + PROOF_CLOCK_SKEW_MS) revert ProofTimeInvalid();
        if (a.signatures.length != 1 || a.signatures[0].length != 65 || a.attestors.length != 1
            || bytes(a.attestors[0].url).length > 128) revert SignatureShapeInvalid();
        UsgsPolicy.checkSource(a);
        e = UsgsPolicy.parse(a.data);
        UsgsPolicy.checkEvent(e);
        if (e.revisionMs > a.timestamp) revert EventOutsideCoverage();
        verifier.verifyAttestation(a);
    }

    function pay(address recipient) private {
        (bool ok,) = recipient.call{value: PRINCIPAL}("");
        if (!ok) revert TransferFailed();
    }

    error EventOutsideCoverage();
}

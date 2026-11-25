// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
import {PrimusZKTLS} from "./vendor/PrimusZKTLS.sol";
import {Attestor} from "./vendor/IPrimusZKTLS.sol";
import {SeismicLock} from "./SeismicLock.sol";

/// @notice Deploys the upstream verifier, freezes its signer set, then deploys a bound escrow.
contract SeismicDeployment {
    address public constant ATTESTOR = 0x5Ed3176045F68617B0958a61ac1868875C98C14d;
    PrimusZKTLS public immutable verifier;
    SeismicLock public immutable escrow;
    event Deployment(address indexed verifier, address indexed escrow);

    constructor(address funder, address beneficiary) {
        PrimusZKTLS primus = new PrimusZKTLS();
        Attestor[] memory signers = new Attestor[](1);
        signers[0] = Attestor(ATTESTOR, "https://primuslabs.xyz");
        primus.initialize(address(this), signers);
        primus.renounceOwnership();
        verifier = primus;
        escrow = new SeismicLock(address(primus), funder, beneficiary);
        emit Deployment(address(primus), address(escrow));
    }
}

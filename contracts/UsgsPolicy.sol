// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
import {Attestation, AttNetworkResponseResolve} from "./vendor/IPrimusZKTLS.sol";

library UsgsPolicy {
    string internal constant SOURCE = "https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&starttime=2023-02-06T01%3A17%3A30&endtime=2023-02-06T01%3A17%3A40&minmagnitude=7&limit=1";
    bytes32 internal constant CONDITIONS = keccak256(bytes("[{\"op\":\"REVEAL_STRING\",\"field\":\"$.features[0].id\",\"reveal_id\":\"eventId\"},{\"op\":\"REVEAL_STRING\",\"field\":\"$.features[0].properties.mag\",\"reveal_id\":\"magnitude\"},{\"op\":\"REVEAL_STRING\",\"field\":\"$.features[0].properties.time\",\"reveal_id\":\"eventTime\"},{\"op\":\"REVEAL_STRING\",\"field\":\"$.features[0].properties.updated\",\"reveal_id\":\"updated\"},{\"op\":\"REVEAL_STRING\",\"field\":\"$.features[0].properties.type\",\"reveal_id\":\"eventType\"},{\"op\":\"REVEAL_STRING\",\"field\":\"$.features[0].properties.status\",\"reveal_id\":\"status\"},{\"op\":\"REVEAL_STRING\",\"field\":\"$.features[0].geometry.coordinates[0]\",\"reveal_id\":\"longitude\"},{\"op\":\"REVEAL_STRING\",\"field\":\"$.features[0].geometry.coordinates[1]\",\"reveal_id\":\"latitude\"}]"));
    uint256 internal constant START_MS = 1675646250000;
    uint256 internal constant END_MS = 1675646260000;
    error SourceMismatch();
    error RulesMismatch();
    error InvalidPayload();
    error EventOutsideCoverage();
    error MagnitudeBelowThreshold();
    error OutsideGeofence();

    struct EventData {
        uint256 eventTimeMs;
        uint256 revisionMs;
        uint256 magnitudeE6;
        uint256 latitudeE6;
        uint256 longitudeE6;
    }

    function same(string calldata actual, string memory expected) private pure returns (bool) {
        return keccak256(bytes(actual)) == keccak256(bytes(expected));
    }

    function checkSource(Attestation calldata a) internal pure {
        if (bytes(a.request.url).length != bytes(SOURCE).length || !same(a.request.url, SOURCE)
            || bytes(a.request.header).length != 0 || bytes(a.request.body).length != 0
            || bytes(a.request.method).length != 3 || !same(a.request.method, "GET")) revert SourceMismatch();
        if (bytes(a.attConditions).length > 1024 || keccak256(bytes(a.attConditions)) != CONDITIONS) revert RulesMismatch();
        AttNetworkResponseResolve[] calldata rules = a.reponseResolve;
        if (rules.length != 8) revert RulesMismatch();
        for (uint256 i; i < rules.length; ++i) {
            if (bytes(rules[i].keyName).length > 12 || bytes(rules[i].parsePath).length > 40) revert RulesMismatch();
        }
        if (!same(rules[0].keyName, "eventId") || !same(rules[0].parsePath, "$.features[0].id") || bytes(rules[0].parseType).length != 0) revert RulesMismatch();
        if (!same(rules[1].keyName, "magnitude") || !same(rules[1].parsePath, "$.features[0].properties.mag") || bytes(rules[1].parseType).length != 0) revert RulesMismatch();
        if (!same(rules[2].keyName, "eventTime") || !same(rules[2].parsePath, "$.features[0].properties.time") || bytes(rules[2].parseType).length != 0) revert RulesMismatch();
        if (!same(rules[3].keyName, "updated") || !same(rules[3].parsePath, "$.features[0].properties.updated") || bytes(rules[3].parseType).length != 0) revert RulesMismatch();
        if (!same(rules[4].keyName, "eventType") || !same(rules[4].parsePath, "$.features[0].properties.type") || bytes(rules[4].parseType).length != 0) revert RulesMismatch();
        if (!same(rules[5].keyName, "status") || !same(rules[5].parsePath, "$.features[0].properties.status") || bytes(rules[5].parseType).length != 0) revert RulesMismatch();
        if (!same(rules[6].keyName, "longitude") || !same(rules[6].parsePath, "$.features[0].geometry.coordinates[0]") || bytes(rules[6].parseType).length != 0) revert RulesMismatch();
        if (!same(rules[7].keyName, "latitude") || !same(rules[7].parsePath, "$.features[0].geometry.coordinates[1]") || bytes(rules[7].parseType).length != 0) revert RulesMismatch();
    }

    function parse(string calldata data) internal pure returns (EventData memory eventData) {
        bytes calldata input = bytes(data);
        if (input.length > 256) revert InvalidPayload();
        uint256 cursor = consume(input, 0, bytes('{"eventId":"us6000jllz","eventTime":"'));
        (eventData.eventTimeMs, cursor) = number(input, cursor, 13, 0);
        cursor = consume(input, cursor, bytes('","eventType":"earthquake","latitude":"'));
        (eventData.latitudeE6, cursor) = number(input, cursor, 2, 6);
        cursor = consume(input, cursor, bytes('","longitude":"'));
        (eventData.longitudeE6, cursor) = number(input, cursor, 3, 6);
        cursor = consume(input, cursor, bytes('","magnitude":"'));
        (eventData.magnitudeE6, cursor) = number(input, cursor, 2, 6);
        cursor = consume(input, cursor, bytes('","status":"reviewed","updated":"'));
        (eventData.revisionMs, cursor) = number(input, cursor, 13, 0);
        if (consume(input, cursor, bytes('"}')) != input.length) revert InvalidPayload();
    }

    function checkEvent(EventData memory e) internal pure {
        if (e.eventTimeMs < START_MS || e.eventTimeMs >= END_MS || e.revisionMs < e.eventTimeMs) revert EventOutsideCoverage();
        if (e.magnitudeE6 > 10_000_000) revert InvalidPayload();
        if (e.magnitudeE6 < 7_500_000) revert MagnitudeBelowThreshold();
        if (e.latitudeE6 < 37_000_000 || e.latitudeE6 > 38_000_000
            || e.longitudeE6 < 36_000_000 || e.longitudeE6 > 38_000_000) revert OutsideGeofence();
    }

    function consume(bytes calldata input, uint256 cursor, bytes memory literal) private pure returns (uint256) {
        uint256 end = cursor + literal.length;
        if (end > input.length || keccak256(input[cursor:end]) != keccak256(literal)) revert InvalidPayload();
        return end;
    }

    function number(bytes calldata input, uint256 cursor, uint256 maxWhole, uint256 decimals)
        private pure returns (uint256 value, uint256 next)
    {
        uint256 start = cursor;
        while (cursor < input.length && digit(input[cursor])) {
            if (cursor - start >= maxWhole || (cursor > start && input[start] == "0")) revert InvalidPayload();
            value = value * 10 + uint8(input[cursor++]) - 48;
        }
        if (cursor == start || (decimals == 0 && cursor - start != maxWhole)) revert InvalidPayload();
        uint256 fractionDigits;
        if (decimals != 0 && cursor < input.length && input[cursor] == ".") {
            ++cursor;
            while (cursor < input.length && digit(input[cursor])) {
                if (fractionDigits == decimals) revert InvalidPayload();
                value = value * 10 + uint8(input[cursor++]) - 48;
                ++fractionDigits;
            }
            if (fractionDigits == 0) revert InvalidPayload();
        }
        return (value * 10 ** (decimals - fractionDigits), cursor);
    }

    function digit(bytes1 c) private pure returns (bool) {
        return c >= "0" && c <= "9";
    }
}

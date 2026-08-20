// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title Topic voting based on the voter-state model taught in Lecture 4
/// @notice Topics are fixed at deployment and each eligible address can vote once.
contract SecureTopicVoting {
    struct Topic {
        string name;
        uint256 voteCount;
    }

    // The zero/default value is Eligible, so everybody may vote unless blocked.
    enum VoterState {
        Eligible,
        Blocked,
        Voted
    }

    error OnlyAdmin();
    error EmptyTopics();
    error EmptyTopicName(uint256 index);
    error InvalidTopic(uint256 topicId);
    error AccountBlocked();
    error AlreadyVoted();
    error ZeroAddress();

    address public immutable admin;
    Topic[] private topics;
    mapping(address voter => VoterState state) public voterState;
    uint256 public totalVotes;

    event VoteCast(address indexed voter, uint256 indexed topicId);
    event VoterStateChanged(address indexed voter, VoterState state);

    modifier onlyAdmin() {
        if (msg.sender != admin) revert OnlyAdmin();
        _;
    }

    constructor(string[] memory topicNames, address[] memory initiallyBlocked) {
        if (topicNames.length == 0) revert EmptyTopics();
        admin = msg.sender;

        for (uint256 i = 0; i < topicNames.length; ++i) {
            if (bytes(topicNames[i]).length == 0) revert EmptyTopicName(i);
            topics.push(Topic({name: topicNames[i], voteCount: 0}));
        }

        for (uint256 i = 0; i < initiallyBlocked.length; ++i) {
            _setBlocked(initiallyBlocked[i], true);
        }
    }

    /// @notice The admin may block or unblock an address that has not voted.
    function setBlocked(address voter, bool blocked) external onlyAdmin {
        _setBlocked(voter, blocked);
    }

    function vote(uint256 topicId) external {
        if (topicId >= topics.length) revert InvalidTopic(topicId);

        VoterState state = voterState[msg.sender];
        if (state == VoterState.Blocked) revert AccountBlocked();
        if (state == VoterState.Voted) revert AlreadyVoted();

        // Record the state before updating the total: one address, one vote.
        voterState[msg.sender] = VoterState.Voted;
        topics[topicId].voteCount += 1;
        totalVotes += 1;
        emit VoteCast(msg.sender, topicId);
        emit VoterStateChanged(msg.sender, VoterState.Voted);
    }

    function topicCount() external view returns (uint256) {
        return topics.length;
    }

    function getTopic(uint256 topicId)
        external
        view
        returns (string memory name, uint256 count)
    {
        _requireValidTopic(topicId);
        Topic storage topic = topics[topicId];
        return (topic.name, topic.voteCount);
    }

    /// @notice Return the lowest-index leader and state whether the lead is tied.
    function winner()
        external
        view
        returns (uint256 topicId, string memory name, uint256 count, bool tied)
    {
        uint256 bestTopic;
        uint256 bestCount = topics[0].voteCount;
        uint256 leaders = 1;

        for (uint256 i = 1; i < topics.length; ++i) {
            uint256 candidateCount = topics[i].voteCount;
            if (candidateCount > bestCount) {
                bestTopic = i;
                bestCount = candidateCount;
                leaders = 1;
            } else if (candidateCount == bestCount) {
                leaders += 1;
            }
        }

        return (bestTopic, topics[bestTopic].name, bestCount, leaders > 1);
    }

    /// @notice Shows the exact EVM address used by msg.sender on Hedera.
    function whoAmI() external view returns (address) {
        return msg.sender;
    }

    function _setBlocked(address voter, bool blocked) private {
        if (voter == address(0)) revert ZeroAddress();
        if (voterState[voter] == VoterState.Voted) revert AlreadyVoted();
        VoterState newState = blocked ? VoterState.Blocked : VoterState.Eligible;
        voterState[voter] = newState;
        emit VoterStateChanged(voter, newState);
    }

    function _requireValidTopic(uint256 topicId) private view {
        if (topicId >= topics.length) revert InvalidTopic(topicId);
    }
}

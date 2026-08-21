// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title Topic voting based on the voter-state model taught in Lecture 4
/// @notice Topics are fixed at deployment and each eligible address can vote once.
contract SecureTopicVoting {
    // Lecture 4 models each voting choice as a name plus a running counter.
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

    // Custom errors stop invalid transactions and are cheaper than long strings.
    error OnlyAdmin();
    error EmptyTopics();
    error EmptyTopicName(uint256 index);
    error InvalidTopic(uint256 topicId);
    error AccountBlocked();
    error CannotBlockVotedUser();
    error AlreadyVoted();
    error ZeroAddress();

    // The deployment account becomes the permanent administrator.
    address public immutable admin;

    // Topics are private so callers use the bounds-checked getTopic() function.
    Topic[] private topics;

    // msg.sender is the key: each EVM address has one persistent voting state.
    mapping(address voter => VoterState state) public voterState;

    // Maintained separately so clients can read the overall turnout directly.
    uint256 public totalVotes;

    // Events create an auditable transaction history on Hedera/HashScan.
    event VoteCast(address indexed voter, uint256 indexed topicId);
    event VoterStateChanged(address indexed voter, VoterState state);

    // This is a check to ensure only admins are able to execute code beyond this func.
    modifier onlyAdmin() {
        // msg.sender is the account calling this function on the EVM.
        if (msg.sender != admin) revert OnlyAdmin();
        _;
    }

    /// @param topicNames Choices fixed for the lifetime of this deployment.
    /// @param initiallyBlocked Exact EVM addresses that begin unable to vote.
    constructor(string[] memory topicNames, address[] memory initiallyBlocked) {
        // A voting contract without any choices would be unusable.
        if (topicNames.length == 0) revert EmptyTopics();
        admin = msg.sender;

        // Convert the constructor's string array into Topic structs in storage.
        for (uint256 i = 0; i < topicNames.length; ++i) {
            if (bytes(topicNames[i]).length == 0) revert EmptyTopicName(i);
            topics.push(Topic({name: topicNames[i], voteCount: 0}));
        }

        // Reuse the same validation and event logic as later admin updates.
        for (uint256 i = 0; i < initiallyBlocked.length; ++i) {
            _setBlocked(initiallyBlocked[i], true);
        }
    }
<<<<<<< Updated upstream

    /// @notice The admin may block or unblock an address that has not voted.
    function setBlocked(address voter, bool blocked) external onlyAdmin {
        _setBlocked(voter, blocked);
    }

    /// @notice Cast one vote for the topic at topicId.
=======
    
>>>>>>> Stashed changes
    function vote(uint256 topicId) external {
        // Check the array boundary before reading or changing contract storage.
        if (topicId >= topics.length) revert InvalidTopic(topicId);

        // The mapping lookup uses the caller address, not a user-supplied address.
        VoterState state = voterState[msg.sender];
        if (state == VoterState.Blocked) revert AccountBlocked();
        if (state == VoterState.Voted) revert AlreadyVoted();

        // Record the state before updating the total: one address, one vote.
        voterState[msg.sender] = VoterState.Voted;
        topics[topicId].voteCount += 1;
        totalVotes += 1;
        // Emit after the state update so a successful event reflects stored state.
        emit VoteCast(msg.sender, topicId);
        emit VoterStateChanged(msg.sender, VoterState.Voted);
    }

    /// @notice Return how many choices the results script must query.
    function topicCount() external view returns (uint256) {
        return topics.length;
    }

    function getTopic(uint256 topicId)
        external
        view
        returns (string memory name, uint256 count)
    {
<<<<<<< Updated upstream
        _requireValidTopic(topicId);
        // A storage reference avoids copying the entire struct unnecessarily.
=======
        if (topicId >= topics.length) revert InvalidTopic(topicId);
>>>>>>> Stashed changes
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

        // Start at index 1 because index 0 is the initial leader.
        for (uint256 i = 1; i < topics.length; ++i) {
            uint256 candidateCount = topics[i].voteCount;
            if (candidateCount > bestCount) {
                bestTopic = i;
                bestCount = candidateCount;
                leaders = 1;
            } else if (candidateCount == bestCount) {
                // A strict-greater replacement keeps the lowest tied index.
                leaders += 1;
            }
        }

        return (bestTopic, topics[bestTopic].name, bestCount, leaders > 1);
    }

    /// @notice Shows the exact EVM address used by msg.sender on Hedera.
    function whoAmI() external view returns (address) {
        return msg.sender;
    }

    function setBlocked(address voter, bool blocked) external onlyAdmin {
        _setBlocked(voter, blocked);
    }

    function _setBlocked(address voter, bool blocked) private {
        // The zero address cannot represent a usable Hedera voter.
        if (voter == address(0)) revert ZeroAddress();
<<<<<<< Updated upstream

        // Never erase the permanent record that an address has already voted.
        if (voterState[voter] == VoterState.Voted) revert AlreadyVoted();
=======
        if (voterState[voter] == VoterState.Voted) revert CannotBlockVotedUser();
>>>>>>> Stashed changes
        VoterState newState = blocked ? VoterState.Blocked : VoterState.Eligible;
        voterState[voter] = newState;
        emit VoterStateChanged(voter, newState);
    }


}

pragma ton-solidity >= 0.36.0;

interface IBid {
  function success(uint128 amount) external;
  function reject() external;
  function collectBidAmount(uint128 amount, address dest) external;
}
pragma ton-solidity >= 0.36.0;

interface IDensRoot {
  function existsCallback() external;
  function auctionCompleted(string name, uint expiresAt, uint owner) external;
}
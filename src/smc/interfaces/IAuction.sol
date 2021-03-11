pragma ton-solidity >= 0.36.0;

interface IAuction {
  function revealBid(uint hashAmount, uint128 amount, uint owner) external;
}
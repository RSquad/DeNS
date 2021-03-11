
pragma ton-solidity >= 0.36.0;

enum ContractType { NIC, Auction, Bid }

struct RegBid {
  string name;
  uint hashAmount;
  uint16 duration;
  uint owner;
}
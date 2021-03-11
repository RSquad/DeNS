pragma ton-solidity >= 0.36.0;

import "./enums.sol";

interface IStoreCallback {
  function updateImage(ContractType kind, TvmCell image) external;
}

contract Store {

  mapping(uint8 => TvmCell) public images;

  modifier signed() {
    require(tvm.pubkey() == msg.pubkey(), 100);
    tvm.accept();
    _;
  }

  function setNicImage(TvmCell image) public signed {
    images[uint8(ContractType.NIC)] = image;
  }

  function setBidImage(TvmCell image) public signed {
    images[uint8(ContractType.Bid)] = image;
  }
  
  function setAuctionImage(TvmCell image) public signed {
    images[uint8(ContractType.Auction)] = image;
  }

  function queryImage(ContractType kind) public view {
    TvmCell image = images[uint8(kind)];
    IStoreCallback(msg.sender).updateImage{value: 0, flag: 64, bounce: false}(kind, image);
  }
}
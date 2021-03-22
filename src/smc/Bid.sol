pragma ton-solidity >= 0.36.0;
pragma AbiHeader expire;
pragma AbiHeader time;
pragma AbiHeader pubkey;

import './Base.sol';
import './interfaces/IAuction.sol';
import './interfaces/IBid.sol';

// errors:
// 100 - msg.sender is null
// 101 - msg.sender is not deployer
// 102 - msg.value is lower that amount
// 103 - auction still ongoing
// 201 - only inbound messages
// 202 - hashes don't match

contract Bid is Base, IBid {
  uint static public _hashAmount;
  address static public _deployer;
  uint public _owner;
  uint128 public _amount;

  constructor(uint owner) public {
    require(_deployer == msg.sender, 100);
    tvm.accept();
    _owner = owner;
  }

  function reveal(uint128 amount, uint salt) public view {
    uint hashAmount = hashAmountWithSalt(amount, salt);
    require(hashAmount == _hashAmount, 202);
    require(msg.sender != address(0), 201);
    require(msg.value > amount + 1 ton, 102);
    tvm.accept();
    IAuction(_deployer).revealBid{
      value: 1 ton,
      flag: 2,
      bounce: true
    }(
      _hashAmount,
      amount,
      _owner
    );
  }

  function success(uint128 amount) external override {
    require(msg.sender == _deployer, 101);
    _amount = amount;
    emit revealSuccess(address(this));
  }

  function reject() external override {
    require(msg.sender == _deployer, 101);
    emit revealRejected(address(this));
  }

  function collectBidAmount(uint128 amount, address dest) external override {
    require(msg.sender == _deployer, 101);
    dest.transfer({value: amount, bounce: false});
  }

  function refund(address dest) public view {
    require(msg.pubkey() == _owner, 101);
    tvm.accept();
    uint128 balance = address(this).balance;
    dest.transfer({value: balance - 300000000, bounce: false});
  }

  event revealSuccess(address addrBid);
  event revealRejected(address addrBid);
}
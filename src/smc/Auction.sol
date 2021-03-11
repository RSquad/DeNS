pragma ton-solidity >= 0.36.0;
pragma AbiHeader expire;

import "./Store.sol";
import "./Base.sol";
import "./Bid.sol";

import './interfaces/IBid.sol';
import './interfaces/IAuction.sol';
import './interfaces/IDensRoot.sol';

import "./enums.sol";

// states:
// 0 - active
// 1 - calcilating
// 2 - ended

// errors:
// 101 - reveal unknown Bid
// 201 - contest finalized
// 206 - contest still on progress
// 207 - contest finalized

contract Auction is Base, IAuction {
  string static public name;
  address static public deployer;

  uint8 public _state = 0;
  uint32 public _duration;

  uint128 public _start;
  uint128 public _reveal;
  uint128 public _end;

  uint128 public _maxAmount;
  uint128 public _secondAmount;
  address public _leader;
  uint public _leaderOwner;

  TvmCell _imageBid;

  constructor(TvmCell imageBid, RegBid regBid) public {
    require(deployer == msg.sender, 100);
    tvm.accept();

    _imageBid = imageBid;

    uint32 duration = 7;
    if(duration * regBid.duration > 28) {
      _duration = 28;
    } else {
      _duration = duration * regBid.duration;
    }

    _start = now;
    _reveal = now + (_duration * 24 * 60 * 60);
    _end = now + ((_duration + 1) * 24 * 60 * 60);

    placeBid(regBid.hashAmount, regBid.owner);
  }

  function resolveBid(uint hashAmount) public view returns (address addrBid) {
    TvmCell state = _buildBidState(hashAmount);
    uint256 hashState = tvm.hash(state);
    addrBid = address.makeAddrStd(0, hashState);
  }

  function placeBid(uint hashAmount, uint owner) public view {
    require(msg.sender != address(0), 100);
    tvm.accept();
    TvmCell state = _buildBidState(hashAmount);

    TvmCell payload = tvm.encodeBody(Bid, owner);
    tvm.deploy(state, payload, 1 ton, 0);
  }

  function revealBid(uint hashAmount, uint128 amount, uint owner) public override {
    require(msg.sender != address(0), 100);
    tvm.accept();
    address addrBid = resolveBid(hashAmount);
    if(msg.sender != addrBid || _state != 1) {
      IBid(addrBid).reject{
        value: 0,
        flag: 64,
        bounce: false
      }();
    } else {
      IBid(addrBid).success{
        value: 0,
        flag: 64,
        bounce: false
      }(amount);
      if(amount >= _maxAmount) {
        _secondAmount = _maxAmount;
        _maxAmount = amount;
        _leader = addrBid;
      } else if(amount > _secondAmount || _secondAmount == _maxAmount) {
        _secondAmount = amount;
      }
      if(_secondAmount == 0) {
        _secondAmount = _maxAmount;
      }
    }
  }

  function finilize() public {
    require(now >= _end, 206);
    require(_state != 2, 207);
    tvm.accept();
    _finilize();
  }

  function _finilize() private {
    IBid(_leader).collectBidAmount{
      value: 1 ton,
      flag: 3,
      bounce: false
    }(_secondAmount + 1 ton, deployer);
    _state = 2;
    IDensRoot(deployer).auctionCompleted{
      value: 1 ton,
      flag: 3,
      bounce: false
    }(name, _duration, _leaderOwner);
  }

  function _buildBidState(uint hashAmount) internal view returns (TvmCell) {
    TvmCell code = _imageBid.toSlice().loadRef();
    return tvm.buildStateInit({
      contr: Bid,
      varInit: {_deployer: address(this), _hashAmount: hashAmount},
      code: code
    });
  }

  // function forceRevealState() public {
  //   tvm.accept();
  //   _state = 1;
  // }
  // function forceEndState() public {
  //   tvm.accept();
  //   _finilize();
  // }
}
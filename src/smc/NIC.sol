pragma ton-solidity >= 0.36.0;
pragma AbiHeader expire;
pragma AbiHeader time;
pragma AbiHeader pubkey;

import './Base.sol';
import './interfaces/IDensRoot.sol';

// errors:
// 201 - msg.sender is not owner
// 205 - nic haven't expired yet

contract NIC is Base {
  string static public _name;
  address static public _deployer;
  address static public _root;

  uint _owner;
  address public _target;
  uint public _expiresAt;

  TvmCell _imageNic;

  struct Whois {
    uint owner;
    address target;
    uint expiresAt;
  }

  modifier checkDestruct {
    if(now >= _expiresAt) {
      destruct();
    }
    _;
  }

  constructor(uint owner, uint expiresAt, TvmCell imageNic) public {
    require(_deployer == msg.sender, 100);
    tvm.accept();
    _owner = owner;
    _imageNic = imageNic;

    _expiresAt = expiresAt;
  }

  function checkExists() public view {
    IDensRoot(_deployer).existsCallback{
      value: 500000000,
      flag: 1,
      bounce: false
    }();
  }

  function whois() public view returns (Whois _whois) {
    _whois = Whois(_owner, _target, _expiresAt);
  }

  function setTarget(address target) checkDestruct public {
    require(msg.pubkey() == _owner, 201);
    tvm.accept();
    _target = target;
  }

  function setOwner(uint owner) checkDestruct public view {
    require(msg.pubkey() == _owner, 201);
    tvm.accept();
    owner = _owner;
  }

  function registerSub(string name, uint owner) checkDestruct public view returns (address addrNic) {
    require(msg.pubkey() == _owner, 201);
    tvm.accept();
    TvmCell state = _buildNicState(name);
    TvmCell payload = tvm.encodeBody(NIC, owner, _expiresAt, _imageNic);
    addrNic = tvm.deploy(state, payload, 1 ton, 0);
  }

  function destruct() public {
    require(now >= _expiresAt, 205);
    tvm.accept();
    selfdestruct(_root);
  }

  function _buildNicState(string name) private view returns (TvmCell) {
    TvmCell code = _imageNic.toSlice().loadRef();
    return tvm.buildStateInit({
      contr: NIC,
      varInit: {_deployer: address(this), _root: _root, _name: name},
      code: code
    });
  }
}
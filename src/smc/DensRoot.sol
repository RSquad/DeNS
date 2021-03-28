pragma ton-solidity >= 0.36.0;
pragma AbiHeader expire;
pragma AbiHeader time;

import "./Base.sol";
import "./NIC.sol";
import "./Auction.sol";
import "./Store.sol";
import "./interfaces/IDensRoot.sol";

import "./enums.sol";

interface INic {
  function checkExists() external;
}

contract DensRoot is Base, IStoreCallback {
  address _addrStore;
  address _addrAuction;
  mapping(address => RegBid) private _pendingNics;
  TvmCell public _imageNic;
  TvmCell _imageAuction;
  TvmCell _imageBid;

  constructor(address addrStore) public {
    require(msg.pubkey() == tvm.pubkey(), 100);
    tvm.accept();

    _addrStore = addrStore;

    Store(addrStore).queryImage {
      value: START_BALANCE,
      flag: 1,
      bounce: true
    }(
      ContractType.NIC
    );
    Store(addrStore).queryImage {
      value: START_BALANCE,
      flag: 1,
      bounce: true
    }(
      ContractType.Auction
    );
    Store(addrStore).queryImage {
      value: START_BALANCE,
      flag: 1,
      bounce: true
    }(
      ContractType.Bid
    );
  }

  onBounce(TvmSlice /* body */) external {
    if(_pendingNics.exists(msg.sender)) {
      address addrAuction = _deployAuction(_pendingNics[msg.sender]);
      emit auctionDeployed(addrAuction);
      delete _pendingNics[msg.sender];
    }
  }

  event auctionDeployed(address addrAuction);
  event nicDeployed(address addrNic);
  event nicExists(address addrNic);

  function registerNic(RegBid regBid) public {
    require(msg.sender != address(0), 100);
    require(msg.value >= 1 ton, 100);
    tvm.accept();
    address addrNic = resolve(regBid.name);
    INic(addrNic).checkExists {
      value: 1 ton,
      flag: 1,
      bounce: true
    }();
    _pendingNics[addrNic] = regBid;
  }

  function resolve(string name) public view returns (address addrNic) {
    for (uint8 j = 0; j < name.byteLength(); j++) {
      string substr = name.substr(j, 1);
      if(substr == '.') {
        return address(0);
      }
    }
    string[] domains = _splitDomains(name);
    address[] addrs;
    for (uint8 i = 0; i < domains.length; i++) {
      if(i == 0) {
        TvmCell state = _buildNicState(domains[i], address(this));
        uint256 hashState = tvm.hash(state);
        addrs.push(address.makeAddrStd(0, hashState));
      } else {
        TvmCell state = _buildNicState(domains[i], addrs[i - 1]);
        uint256 hashState = tvm.hash(state);
        addrs.push(address.makeAddrStd(0, hashState));
      }
    }
    addrNic = addrs[addrs.length - 1];
  }

  function resolveAuction(string name) public view returns (address addrAuction) {
    TvmCell state = _buildAuctionState(name);
    uint256 hashState = tvm.hash(state);
    addrAuction = address.makeAddrStd(0, hashState);
  }

  function updateImage(ContractType kind, TvmCell image) external override {
    if(kind == ContractType.NIC) {
      _imageNic = image;
    }
    if(kind == ContractType.Auction) {
      _imageAuction = image;
    }
    if(kind == ContractType.Bid) {
      _imageBid = image;
    }
  }

  function existsCallback() public {
      emit nicExists(msg.sender);
      delete _pendingNics[msg.sender];
  }

  function auctionCompleted(string name, uint expiresAt, uint owner) public view {
    address addrAuction = resolveAuction(name);
    require(msg.sender == addrAuction, 300);
    _deployNic(name, expiresAt, owner);
  }

  function _deployNic(string name, uint expiresAt, uint owner) private view returns (address addrNic) {
    TvmCell state = _buildNicState(name, address(this));

    TvmCell payload = tvm.encodeBody(NIC, owner, expiresAt, _imageNic);
    addrNic = tvm.deploy(state, payload, 3 ton, 0);
	}

  function _deployAuction(RegBid regBid) internal returns (address addrAuction) {
    TvmCell state = _buildAuctionState(regBid.name);
		addrAuction = new Auction{
      stateInit: state,
      value: START_BALANCE
    }(
      _imageBid,
      regBid
    );

    _addrAuction = addrAuction;
	}

  function _buildNicState(string name, address deployer) internal view returns (TvmCell) {
    TvmCell code = _imageNic.toSlice().loadRef();
    return tvm.buildStateInit({
      contr: NIC,
      varInit: {_deployer: deployer, _root: address(this), _name: name},
      code: code
    });
  }

  function _buildAuctionState(string name) internal view returns (TvmCell) {
    TvmCell code = _imageAuction.toSlice().loadRef();
    return tvm.buildStateInit({
      contr: Auction,
      varInit: {deployer: address(this), name: name},
      code: code
    });
  }

  function _splitDomains(string name) private pure returns (string[] domains) {
    string _str = name;
    _str.append('/');
    uint8 lengthStr = _str.byteLength();
    uint8 chuckStartIndex = 0;
    for (uint8 i = 0; i < lengthStr; i++) {
      string substr = _str.substr(i, 1);
      if(substr == '/') {
        domains.push(_str.substr(chuckStartIndex, i - chuckStartIndex));
        chuckStartIndex = i + 1;
      }
    }
  }

  // test functions

  function forceRegisterNic(string name, uint owner, uint expiresAt) public view returns (address addrNic) {
    tvm.accept();
    addrNic = _deployNic(name, expiresAt, owner);
  }
}
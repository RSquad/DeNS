
pragma ton-solidity >=0.35.0;
pragma AbiHeader expire;
pragma AbiHeader time;
pragma AbiHeader pubkey;
import "./Debot.sol";
import "./Terminal.sol";
import "./AddressInput.sol";
import "./AmountInput.sol";
import "./NumberInput.sol";
import "./ConfirmInput.sol";
import "./Sdk.sol";
import "./Menu.sol";
import "./Transferable.sol";
import "./Upgradable.sol";

struct RegBid {
  string name;
  uint hashAmount;
  uint16 duration;
  uint owner;
}

interface IMultisig {
    function submitTransaction(
        address  dest,
        uint128 value,
        bool bounce,
        bool allBalance,
        TvmCell payload)
    external returns (uint64 transId);
}

interface IDensRoot {
  function resolve(string name) external returns (address addrNic);
  function registerNic(RegBid regBid) external;
  function hashAmountWithSalt(uint128 amount, uint salt) external returns (uint hash);
}
interface INic {
  struct Whois {
    uint owner;
    address target;
    uint expiresAt;
  }

  function whois() external returns (Whois _whois);
}

contract DensDebot is Debot, Transferable, Upgradable {
  address _addrDensRoot;
  address _addrMultisig;
  uint128 _amount;
  uint256 _salt;
  RegBid _regBid;
  TvmCell _imageNic;
  TvmCell _imageAuction;
  TvmCell _imageBid;

  struct Whois {
    uint owner;
    address target;
    uint expiresAt;
  }

  function onCodeUpgrade() internal override {
    tvm.resetStorage();
  }

  function setAbi(string debotAbi) public {
    require(tvm.pubkey() == msg.pubkey(), 100);
    tvm.accept();
    m_options |= DEBOT_ABI;
    m_debotAbi = debotAbi;
  }

  function setImageNic(TvmCell image) public {
    require(tvm.pubkey() == msg.pubkey(), 100);
    tvm.accept();
    _imageNic = image;
  }

  function setImageAuction(TvmCell image) public {
    require(tvm.pubkey() == msg.pubkey(), 100);
    tvm.accept();
    _imageAuction = image;
  }

  function setImageBid(TvmCell image) public {
    require(tvm.pubkey() == msg.pubkey(), 100);
    tvm.accept();
    _imageBid = image;
  }

  function start() public override {
    Terminal.print(0, "You wanna dance? Let's DeNS!");
    _start();
  }

  function _start() private {
    Menu.select(
      "Do you want to deploy new DeNS Root or you have existed?",
      "",
      [
        MenuItem("I have existed", "", tvm.functionId(askDensRootAddress)),
        MenuItem("I want to deploy new", "", 0)
      ]
    );
  }

  function _version(uint24 major, uint24 minor, uint24 fix) private pure inline returns (uint24) {
      return (major << 16) | (minor << 8) | (fix);
  }

  function getVersion() public override returns (string name, uint24 semver) {
      (name, semver) = ("DeNS DeBot by RSquad", _version(1,0,0));
  }

  function askDensRootAddress(uint32 index) public {
    index;
    AddressInput.get(tvm.functionId(startChecks), "Type DeNSRoot address");
  }

  function startChecks(address value) public {
    Sdk.getAccountType(tvm.functionId(checkStatus), value);
    _addrDensRoot = value;
  }

  function checkStatus(int8 acc_type) public {
    if (!_checkActiveStatus(acc_type, "DensRoot")) return;
    densMainMenu();
  }

  function densMainMenu() public {
    string desc;
    if(_addrMultisig != address(0)) {
      desc = format("Multisig conncted: {}", _addrMultisig);
    } else {
      desc = "Multisig unconnected";
    }
    Menu.select(
      "DeNS!",
      desc,
      [
        MenuItem("Set Multisig", "", tvm.functionId(askMultisig)),
        MenuItem("Register name", "", tvm.functionId(askDataForRegister)),
        MenuItem("Resolve name", "", tvm.functionId(askNameForResolve)),
        MenuItem("Resolve name to NIC address", "", tvm.functionId(askNameForResolveToAddress))
      ]
    );
  }

  function askMultisig(uint32 index) public {
    index;
    AddressInput.get(tvm.functionId(saveMultisig), "Type Multisig address");
  }

  function saveMultisig(address value) public {
    _addrMultisig = value;
    Terminal.print(tvm.functionId(densMainMenu), format("Multisig address: {}", value));
  }

  function askDataForRegister(uint32 index) public {
    index;
    Terminal.input(tvm.functionId(askDataForRegister2), "Type name", false);
  }
  function askDataForRegister2(string value) public {
    _regBid.name = value;
    Terminal.input(tvm.functionId(askDataForRegister3), "Type owner", false);
  }
  function askDataForRegister3(string value) public {
    (_regBid.owner,) = stoi(value);
    AmountInput.get(tvm.functionId(askDataForRegister4), "Type amount", 9, 1000000000, 1000000000000000);
  }
  function askDataForRegister4(int128 value) public {
    uint salt = rnd.next();
    _salt = salt;
    Terminal.print(0, format("Your salt: {} \n REMIND IT!", salt));
    IDensRoot(_addrDensRoot).hashAmountWithSalt{
      abiVer: 2,
      extMsg: true,
      sign: false,
      time: uint64(now),
      expire: 0,
      callbackId: tvm.functionId(askDataForRegister5),
      onErrorId: 0
    }(_amount, _salt);
  }
  function askDataForRegister5(uint hash) public {
    _regBid.hashAmount = hash;
    Terminal.print(tvm.functionId(askDataForRegister6), format("Your hash: {}", hash));
  }
  function askDataForRegister6() public {
    NumberInput.get(tvm.functionId(askDataForRegister7), "Type registration duraction (years)", 1, 100);
  }
  function askDataForRegister7(int256 value) public {
    _regBid.duration = uint16(value);
    Terminal.print(tvm.functionId(askDataForRegister8), format("Your regBid: \nname: {} \nhashAmount: {} \nduration: {} \nowner: {}",
      _regBid.name,
      _regBid.hashAmount,
      _regBid.duration,
      _regBid.owner
    ));
  }
  function askDataForRegister8() public {
    optional(uint256) pubkey = 0;
    TvmCell body = tvm.encodeBody(IDensRoot.registerNic, _regBid);
    IMultisig(_addrMultisig).submitTransaction{
      abiVer: 2,
      extMsg: true,
      sign: true,
      pubkey: pubkey,
      time: uint64(now),
      expire: 0,
      callbackId: 0,
      onErrorId: 0
    }(_addrDensRoot, 1 ton, true, false, body);
    Terminal.print(tvm.functionId(densMainMenu), "done");
  }

  function askNameForResolve(uint32 index) public {
    index;
    Terminal.input(tvm.functionId(resolveName), "Type name", false);
  }

  function askNameForResolveToAddress(uint32 index) public {
    index;
    Terminal.input(tvm.functionId(resolveNameToAddress), "Type name", false);
  }

  function resolveName(string value) public {
    IDensRoot(_addrDensRoot).resolve{
      abiVer: 2,
      extMsg: true,
      sign: false,
      time: uint64(now),
      expire: 0,
      callbackId: tvm.functionId(getNicWhois),
      onErrorId: 0
    }(value);
  }

  function resolveNameToAddress(string value) public {
    IDensRoot(_addrDensRoot).resolve{
      abiVer: 2,
      extMsg: true,
      sign: false,
      time: uint64(now),
      expire: 0,
      callbackId: tvm.functionId(printResolveNameToAddress),
      onErrorId: 0
    }(value);
  }

  function printResolveNameToAddress(address addrNic) public {
    Terminal.print(0, format('NIC address: {}', addrNic));
  }

  function getNicWhois(address addrNic) public {
    INic(addrNic).whois{
      abiVer: 2,
      extMsg: true,
      sign: false,
      time: uint64(now),
      expire: 0,
      callbackId: 0,
      onErrorId: 0
    }();
  }

  function printGetNicWhois(Whois _whois) public {
    Terminal.print(0,
      format(
        'whois: \n owner: {} \n target: {} \n expiresAt: {}',
        _whois.owner,
        _whois.target,
        _whois.expiresAt
      ));
  }

  

  function _checkActiveStatus(int8 acc_type, string obj) private returns (bool) {
    if (acc_type == -1)  {
      Terminal.print(0, obj + " is inactive");
      return false;
    }
    if (acc_type == 0) {
      Terminal.print(0, obj + " is uninitialized");
      return false;
    }
    if (acc_type == 2) {
      Terminal.print(0, obj + " is frozen");
      return false;
    }
    return true;
  }
}
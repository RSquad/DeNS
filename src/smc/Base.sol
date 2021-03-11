pragma ton-solidity >= 0.36.0;

contract Base  {

  uint16 constant ERROR_DIFFERENT_CALLER =  211;

  uint128 constant START_BALANCE = 3 ton;
  uint128 constant DEPLOYER_FEE = 0.05 ton;
  uint128 constant DEPLOY_FEE = START_BALANCE + DEPLOYER_FEE;

  modifier signed {
    require(msg.pubkey() == tvm.pubkey(), 101);
    tvm.accept();
    _;
  }

  modifier me {
    require(msg.sender == address(this), ERROR_DIFFERENT_CALLER);
    _;
  }

  modifier accept {
    tvm.accept();
    _;
  }

  function hashAmountWithSalt(uint128 amount, uint salt) public pure returns (uint hash) {
    TvmBuilder builder;
    builder.store(amount, salt);
    TvmCell cell = builder.toCell();
    hash = tvm.hash(cell);
  }
}

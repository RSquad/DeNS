cd /projects
solc DensDebot.sol
tvm_linker compile DensDebot.code --lib /usr/bin/stdlib_sol.tvm --abi-json DensDebot.abi.json > DensDebot.result
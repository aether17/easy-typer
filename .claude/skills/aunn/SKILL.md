---
name: aunn
description: Stories and bugs of this project are tracked with the aunn command. Use when the user mentions an item ID such as TYPE-45, asks to create a story or bug, or asks to commit work for an item.
allowed-tools: Bash(aunn guide)
---

# aunn

This project keeps its stories and bugs (items) in aunn. The usage below is printed by the aunn program installed on this machine:

!`aunn guide || echo "aunn is not installed on this machine."`

If aunn is not installed, tell the user to install it and set it up once on this machine:

```sh
curl -fsSL https://aunn.mashiro.cafe/install.sh | sh
aunn setup
```

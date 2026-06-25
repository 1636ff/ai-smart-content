@echo off
set "PATH=C:\Program Files\nodejs;%PATH%"
cd /d C:\Users\琮琮\ai-money-engine
echo [%date% %time%] ===== AI赚钱流水线开始 ===== >> logs\pipeline.log
"C:\Program Files\nodejs\npm.cmd" run pipeline >> logs\pipeline.log 2>&1
echo [%date% %time%] ===== 完成 ===== >> logs\pipeline.log

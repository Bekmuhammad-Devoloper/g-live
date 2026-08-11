@echo off
title GL-EDU telefoniya tunneli (AMI 5039)
color 0B
echo.
echo  ============================================================
echo    GL-EDU  telefoniya tunneli   (parolsiz - SSH kalit)
echo    localhost:5039  ==^>  89.126.208.123  asterisk-glive AMI
echo.
echo    Bu oyna OCHIQ tursin. Yopilsa qo'ng'iroq ishlamaydi.
echo    Eski loyihaga (5038) TEGMAYDI - faqat yangi 5039.
echo  ============================================================
echo.

:loop
echo  [%TIME:~0,8%]  ulanmoqda...
ssh -N -i "%USERPROFILE%\.ssh\gl-tunnel" -o BatchMode=yes -o StrictHostKeyChecking=accept-new ^
    -o ServerAliveInterval=30 -o ServerAliveCountMax=3 -o ExitOnForwardFailure=yes ^
    -L 5039:127.0.0.1:5039 ubuntu@89.126.208.123
echo  [%TIME:~0,8%]  uzildi - 5 soniyadan keyin qayta ulanadi...
timeout /t 5 /nobreak >nul
goto loop

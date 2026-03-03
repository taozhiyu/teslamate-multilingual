# Teslamate Multilingual Dockerfile
# 基于 teslamate 官方镜像，添加多语言 dashboard 支持

# 构建参数
ARG TESLAMATE_VERSION=latest
ARG DASHBOARD_LANG=zh-CN

# 基础镜像 - 使用 teslamate 官方镜像
FROM teslamate/teslamate:${TESLAMATE_VERSION}

# 设置语言环境
ENV LANG=C.UTF-8 \
    LC_ALL=C.UTF-8 \
    TERM=xterm

# 复制对应语言的 dashboard 文件
# 注意: 构建时会自动替换 {lang} 为目标语言
COPY dashboards/${DASHBOARD_LANG}/ /etc/teslamate/grafana/dashboards/

# 设置默认时区
ENV TZ=Asia/Shanghai

# 暴露端口
EXPOSE 3000 4000 5432

# 启动命令
CMD ["tail", "-f", "/dev/null"]
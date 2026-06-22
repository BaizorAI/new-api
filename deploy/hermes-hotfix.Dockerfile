FROM ccr.ccs.tencentyun.com/lucky/baizor-hermes:1.0.2

USER root

COPY hermes-agent/gateway/platforms/api_server.py /opt/hermes/gateway/platforms/api_server.py
COPY hermes-agent/agent/skill_utils.py /opt/hermes/agent/skill_utils.py
COPY hermes-agent/tools/skill_manager_tool.py /opt/hermes/tools/skill_manager_tool.py
COPY hermes-agent/tools/skills_tool.py /opt/hermes/tools/skills_tool.py

RUN sed -i 's/\r$//' \
      /opt/hermes/gateway/platforms/api_server.py \
      /opt/hermes/agent/skill_utils.py \
      /opt/hermes/tools/skill_manager_tool.py \
      /opt/hermes/tools/skills_tool.py && \
    chown root:root \
      /opt/hermes/gateway/platforms/api_server.py \
      /opt/hermes/agent/skill_utils.py \
      /opt/hermes/tools/skill_manager_tool.py \
      /opt/hermes/tools/skills_tool.py && \
    chmod 0555 \
      /opt/hermes/gateway/platforms/api_server.py \
      /opt/hermes/agent/skill_utils.py \
      /opt/hermes/tools/skill_manager_tool.py \
      /opt/hermes/tools/skills_tool.py

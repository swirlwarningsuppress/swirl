/*
 * Licensed to the Apache Software Foundation (ASF) under one or more
 * contributor license agreements.  See the NOTICE file distributed with
 * this work for additional information regarding copyright ownership.
 * The ASF licenses this file to You under the Apache License, Version 2.0
 * (the "License"); you may not use this file except in compliance with
 * the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
package org.apache.rocketmq.tieredstore.util;

import com.google.common.annotations.VisibleForTesting;
import java.io.File;
import java.lang.reflect.Constructor;
import java.math.BigInteger;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.text.DecimalFormat;
import java.text.NumberFormat;
import java.util.LinkedList;
import java.util.List;
import org.apache.commons.lang3.StringUtils;
import org.apache.rocketmq.common.message.MessageQueue;
import org.apache.rocketmq.common.topic.TopicValidator;
import org.apache.rocketmq.logging.org.slf4j.Logger;
import org.apache.rocketmq.logging.org.slf4j.LoggerFactory;
import org.apache.rocketmq.tieredstore.common.TieredMessageStoreConfig;
import org.apache.rocketmq.tieredstore.metadata.TieredMetadataStore;

public class TieredStoreUtil {

    private static final Logger logger = LoggerFactory.getLogger(TieredStoreUtil.TIERED_STORE_LOGGER_NAME);

    public static final long BYTE = 1L;
    public static final long KB = BYTE << 10;
    public static final long MB = KB << 10;
    public static final long GB = MB << 10;
    public static final long TB = GB << 10;
    public static final long PB = TB << 10;
    public static final long EB = PB << 10;

    public static final String TIERED_STORE_LOGGER_NAME = "RocketmqTieredStore";
    public static final String RMQ_SYS_TIERED_STORE_INDEX_TOPIC = "rmq_sys_INDEX";
    public final static int MSG_ID_LENGTH = 8 + 8;

    private static final DecimalFormat DEC_FORMAT = new DecimalFormat("#.##");

    private final static List<String> SYSTEM_TOPIC_LIST = new LinkedList<String>() {
        {
            add(RMQ_SYS_TIERED_STORE_INDEX_TOPIC);
        }
    };

    private final static List<String> SYSTEM_TOPIC_WHITE_LIST = new LinkedList<>();

    @VisibleForTesting
    public volatile static TieredMetadataStore metadataStoreInstance;

    public static String getHash(String str) {
        try {
            MessageDigest md = MessageDigest.getInstance("MD5");
            md.update(str.getBytes(StandardCharsets.UTF_8));
            byte[] digest = md.digest();
            return String.format("%032x", new BigInteger(1, digest)).substring(0, 8);
        } catch (Exception ignore) {
            return "";
        }
    }

const std = @import("std");
const build_utils = @import("build_utils.zig");

fn buildForTarget(
    b: *std.Build,
    target: std.Build.ResolvedTarget,
    optimize: std.builtin.OptimizeMode,
    artifacts_dir: []const u8,
    hashes: *std.StringHashMap([]const u8),
    json_step: *build_utils.WriteJsonStep,
) void {
    const target_str = build_utils.getTargetString(target);
    const lib_name = build_utils.getLibName(std.heap.page_allocator, "opus", target_str);

    const lib = b.addLibrary(.{
        .name = lib_name,
        .linkage = .dynamic,
        .root_module = b.createModule(.{
            .root_source_file = b.path("src/main.zig"),
            .target = target,
            .optimize = optimize,
        }),
    });

    lib.root_module.link_libc = true;

    // Upstream is a plain float build (no FIXED_POINT, no custom modes).
    // HAVE_CONFIG_H is never defined: arch.h / os_support.h fall back to
    // generic defines, which is exactly the supported no-configure path.
    // VAR_ARRAYS selects stack VLAs for CELT scratch space (same as the
    // default autotools build on a hosted compiler).
    const flags = &[_][]const u8{
        "-O2",
        "-fPIC",
        "-fvisibility=hidden",
        "-DOPUS_BUILD",
        "-DVAR_ARRAYS",
    };

    lib.root_module.addCSourceFile(.{
        .file = b.path("vendor/opus-vendor/silk/CNG.c"),
        .flags = flags,
    });
    lib.root_module.addCSourceFile(.{
        .file = b.path("vendor/opus-vendor/silk/code_signs.c"),
        .flags = flags,
    });
    lib.root_module.addCSourceFile(.{
        .file = b.path("vendor/opus-vendor/silk/init_decoder.c"),
        .flags = flags,
    });
    lib.root_module.addCSourceFile(.{
        .file = b.path("vendor/opus-vendor/silk/decode_core.c"),
        .flags = flags,
    });
    lib.root_module.addCSourceFile(.{
        .file = b.path("vendor/opus-vendor/silk/decode_frame.c"),
        .flags = flags,
    });
    lib.root_module.addCSourceFile(.{
        .file = b.path("vendor/opus-vendor/silk/decode_parameters.c"),
        .flags = flags,
    });
    lib.root_module.addCSourceFile(.{
        .file = b.path("vendor/opus-vendor/silk/decode_indices.c"),
        .flags = flags,
    });
    lib.root_module.addCSourceFile(.{
        .file = b.path("vendor/opus-vendor/silk/decode_pulses.c"),
        .flags = flags,
    });
    lib.root_module.addCSourceFile(.{
        .file = b.path("vendor/opus-vendor/silk/decoder_set_fs.c"),
        .flags = flags,
    });
    lib.root_module.addCSourceFile(.{
        .file = b.path("vendor/opus-vendor/silk/dec_API.c"),
        .flags = flags,
    });
    lib.root_module.addCSourceFile(.{
        .file = b.path("vendor/opus-vendor/silk/enc_API.c"),
        .flags = flags,
    });
    lib.root_module.addCSourceFile(.{
        .file = b.path("vendor/opus-vendor/silk/encode_indices.c"),
        .flags = flags,
    });
    lib.root_module.addCSourceFile(.{
        .file = b.path("vendor/opus-vendor/silk/encode_pulses.c"),
        .flags = flags,
    });
    lib.root_module.addCSourceFile(.{
        .file = b.path("vendor/opus-vendor/silk/gain_quant.c"),
        .flags = flags,
    });
    lib.root_module.addCSourceFile(.{
        .file = b.path("vendor/opus-vendor/silk/interpolate.c"),
        .flags = flags,
    });
    lib.root_module.addCSourceFile(.{
        .file = b.path("vendor/opus-vendor/silk/LP_variable_cutoff.c"),
        .flags = flags,
    });
    lib.root_module.addCSourceFile(.{
        .file = b.path("vendor/opus-vendor/silk/NLSF_decode.c"),
        .flags = flags,
    });
    lib.root_module.addCSourceFile(.{
        .file = b.path("vendor/opus-vendor/silk/NSQ.c"),
        .flags = flags,
    });
    lib.root_module.addCSourceFile(.{
        .file = b.path("vendor/opus-vendor/silk/NSQ_del_dec.c"),
        .flags = flags,
    });
    lib.root_module.addCSourceFile(.{
        .file = b.path("vendor/opus-vendor/silk/PLC.c"),
        .flags = flags,
    });
    lib.root_module.addCSourceFile(.{
        .file = b.path("vendor/opus-vendor/silk/shell_coder.c"),
        .flags = flags,
    });
    lib.root_module.addCSourceFile(.{
        .file = b.path("vendor/opus-vendor/silk/tables_gain.c"),
        .flags = flags,
    });
    lib.root_module.addCSourceFile(.{
        .file = b.path("vendor/opus-vendor/silk/tables_LTP.c"),
        .flags = flags,
    });
    lib.root_module.addCSourceFile(.{
        .file = b.path("vendor/opus-vendor/silk/tables_NLSF_CB_NB_MB.c"),
        .flags = flags,
    });
    lib.root_module.addCSourceFile(.{
        .file = b.path("vendor/opus-vendor/silk/tables_NLSF_CB_WB.c"),
        .flags = flags,
    });
    lib.root_module.addCSourceFile(.{
        .file = b.path("vendor/opus-vendor/silk/tables_other.c"),
        .flags = flags,
    });
    lib.root_module.addCSourceFile(.{
        .file = b.path("vendor/opus-vendor/silk/tables_pitch_lag.c"),
        .flags = flags,
    });
    lib.root_module.addCSourceFile(.{
        .file = b.path("vendor/opus-vendor/silk/tables_pulses_per_block.c"),
        .flags = flags,
    });
    lib.root_module.addCSourceFile(.{
        .file = b.path("vendor/opus-vendor/silk/VAD.c"),
        .flags = flags,
    });
    lib.root_module.addCSourceFile(.{
        .file = b.path("vendor/opus-vendor/silk/control_audio_bandwidth.c"),
        .flags = flags,
    });
    lib.root_module.addCSourceFile(.{
        .file = b.path("vendor/opus-vendor/silk/quant_LTP_gains.c"),
        .flags = flags,
    });
    lib.root_module.addCSourceFile(.{
        .file = b.path("vendor/opus-vendor/silk/VQ_WMat_EC.c"),
        .flags = flags,
    });
    lib.root_module.addCSourceFile(.{
        .file = b.path("vendor/opus-vendor/silk/HP_variable_cutoff.c"),
        .flags = flags,
    });
    lib.root_module.addCSourceFile(.{
        .file = b.path("vendor/opus-vendor/silk/NLSF_encode.c"),
        .flags = flags,
    });
    lib.root_module.addCSourceFile(.{
        .file = b.path("vendor/opus-vendor/silk/NLSF_VQ.c"),
        .flags = flags,
    });
    lib.root_module.addCSourceFile(.{
        .file = b.path("vendor/opus-vendor/silk/NLSF_unpack.c"),
        .flags = flags,
    });
    lib.root_module.addCSourceFile(.{
        .file = b.path("vendor/opus-vendor/silk/NLSF_del_dec_quant.c"),
        .flags = flags,
    });
    lib.root_module.addCSourceFile(.{
        .file = b.path("vendor/opus-vendor/silk/process_NLSFs.c"),
        .flags = flags,
    });
    lib.root_module.addCSourceFile(.{
        .file = b.path("vendor/opus-vendor/silk/stereo_LR_to_MS.c"),
        .flags = flags,
    });
    lib.root_module.addCSourceFile(.{
        .file = b.path("vendor/opus-vendor/silk/stereo_MS_to_LR.c"),
        .flags = flags,
    });
    lib.root_module.addCSourceFile(.{
        .file = b.path("vendor/opus-vendor/silk/check_control_input.c"),
        .flags = flags,
    });
    lib.root_module.addCSourceFile(.{
        .file = b.path("vendor/opus-vendor/silk/control_SNR.c"),
        .flags = flags,
    });
    lib.root_module.addCSourceFile(.{
        .file = b.path("vendor/opus-vendor/silk/init_encoder.c"),
        .flags = flags,
    });
    lib.root_module.addCSourceFile(.{
        .file = b.path("vendor/opus-vendor/silk/control_codec.c"),
        .flags = flags,
    });
    lib.root_module.addCSourceFile(.{
        .file = b.path("vendor/opus-vendor/silk/A2NLSF.c"),
        .flags = flags,
    });
    lib.root_module.addCSourceFile(.{
        .file = b.path("vendor/opus-vendor/silk/ana_filt_bank_1.c"),
        .flags = flags,
    });
    lib.root_module.addCSourceFile(.{
        .file = b.path("vendor/opus-vendor/silk/biquad_alt.c"),
        .flags = flags,
    });
    lib.root_module.addCSourceFile(.{
        .file = b.path("vendor/opus-vendor/silk/bwexpander_32.c"),
        .flags = flags,
    });
    lib.root_module.addCSourceFile(.{
        .file = b.path("vendor/opus-vendor/silk/bwexpander.c"),
        .flags = flags,
    });
    lib.root_module.addCSourceFile(.{
        .file = b.path("vendor/opus-vendor/silk/debug.c"),
        .flags = flags,
    });
    lib.root_module.addCSourceFile(.{
        .file = b.path("vendor/opus-vendor/silk/decode_pitch.c"),
        .flags = flags,
    });
    lib.root_module.addCSourceFile(.{
        .file = b.path("vendor/opus-vendor/silk/inner_prod_aligned.c"),
        .flags = flags,
    });
    lib.root_module.addCSourceFile(.{
        .file = b.path("vendor/opus-vendor/silk/lin2log.c"),
        .flags = flags,
    });
    lib.root_module.addCSourceFile(.{
        .file = b.path("vendor/opus-vendor/silk/log2lin.c"),
        .flags = flags,
    });
    lib.root_module.addCSourceFile(.{
        .file = b.path("vendor/opus-vendor/silk/LPC_analysis_filter.c"),
        .flags = flags,
    });
    lib.root_module.addCSourceFile(.{
        .file = b.path("vendor/opus-vendor/silk/LPC_inv_pred_gain.c"),
        .flags = flags,
    });
    lib.root_module.addCSourceFile(.{
        .file = b.path("vendor/opus-vendor/silk/table_LSF_cos.c"),
        .flags = flags,
    });
    lib.root_module.addCSourceFile(.{
        .file = b.path("vendor/opus-vendor/silk/NLSF2A.c"),
        .flags = flags,
    });
    lib.root_module.addCSourceFile(.{
        .file = b.path("vendor/opus-vendor/silk/NLSF_stabilize.c"),
        .flags = flags,
    });
    lib.root_module.addCSourceFile(.{
        .file = b.path("vendor/opus-vendor/silk/NLSF_VQ_weights_laroia.c"),
        .flags = flags,
    });
    lib.root_module.addCSourceFile(.{
        .file = b.path("vendor/opus-vendor/silk/pitch_est_tables.c"),
        .flags = flags,
    });
    lib.root_module.addCSourceFile(.{
        .file = b.path("vendor/opus-vendor/silk/resampler.c"),
        .flags = flags,
    });
    lib.root_module.addCSourceFile(.{
        .file = b.path("vendor/opus-vendor/silk/resampler_down2_3.c"),
        .flags = flags,
    });
    lib.root_module.addCSourceFile(.{
        .file = b.path("vendor/opus-vendor/silk/resampler_down2.c"),
        .flags = flags,
    });
    lib.root_module.addCSourceFile(.{
        .file = b.path("vendor/opus-vendor/silk/resampler_private_AR2.c"),
        .flags = flags,
    });
    lib.root_module.addCSourceFile(.{
        .file = b.path("vendor/opus-vendor/silk/resampler_private_down_FIR.c"),
        .flags = flags,
    });
    lib.root_module.addCSourceFile(.{
        .file = b.path("vendor/opus-vendor/silk/resampler_private_IIR_FIR.c"),
        .flags = flags,
    });
    lib.root_module.addCSourceFile(.{
        .file = b.path("vendor/opus-vendor/silk/resampler_private_up2_HQ.c"),
        .flags = flags,
    });
    lib.root_module.addCSourceFile(.{
        .file = b.path("vendor/opus-vendor/silk/resampler_rom.c"),
        .flags = flags,
    });
    lib.root_module.addCSourceFile(.{
        .file = b.path("vendor/opus-vendor/silk/sigm_Q15.c"),
        .flags = flags,
    });
    lib.root_module.addCSourceFile(.{
        .file = b.path("vendor/opus-vendor/silk/sort.c"),
        .flags = flags,
    });
    lib.root_module.addCSourceFile(.{
        .file = b.path("vendor/opus-vendor/silk/sum_sqr_shift.c"),
        .flags = flags,
    });
    lib.root_module.addCSourceFile(.{
        .file = b.path("vendor/opus-vendor/silk/stereo_decode_pred.c"),
        .flags = flags,
    });
    lib.root_module.addCSourceFile(.{
        .file = b.path("vendor/opus-vendor/silk/stereo_encode_pred.c"),
        .flags = flags,
    });
    lib.root_module.addCSourceFile(.{
        .file = b.path("vendor/opus-vendor/silk/stereo_find_predictor.c"),
        .flags = flags,
    });
    lib.root_module.addCSourceFile(.{
        .file = b.path("vendor/opus-vendor/silk/stereo_quant_pred.c"),
        .flags = flags,
    });
    lib.root_module.addCSourceFile(.{
        .file = b.path("vendor/opus-vendor/silk/LPC_fit.c"),
        .flags = flags,
    });
    lib.root_module.addCSourceFile(.{
        .file = b.path("vendor/opus-vendor/silk/fixed/LTP_analysis_filter_FIX.c"),
        .flags = flags,
    });
    lib.root_module.addCSourceFile(.{
        .file = b.path("vendor/opus-vendor/silk/fixed/LTP_scale_ctrl_FIX.c"),
        .flags = flags,
    });
    lib.root_module.addCSourceFile(.{
        .file = b.path("vendor/opus-vendor/silk/fixed/corrMatrix_FIX.c"),
        .flags = flags,
    });
    lib.root_module.addCSourceFile(.{
        .file = b.path("vendor/opus-vendor/silk/fixed/encode_frame_FIX.c"),
        .flags = flags,
    });
    lib.root_module.addCSourceFile(.{
        .file = b.path("vendor/opus-vendor/silk/fixed/find_LPC_FIX.c"),
        .flags = flags,
    });
    lib.root_module.addCSourceFile(.{
        .file = b.path("vendor/opus-vendor/silk/fixed/find_LTP_FIX.c"),
        .flags = flags,
    });
    lib.root_module.addCSourceFile(.{
        .file = b.path("vendor/opus-vendor/silk/fixed/find_pitch_lags_FIX.c"),
        .flags = flags,
    });
    lib.root_module.addCSourceFile(.{
        .file = b.path("vendor/opus-vendor/silk/fixed/find_pred_coefs_FIX.c"),
        .flags = flags,
    });
    lib.root_module.addCSourceFile(.{
        .file = b.path("vendor/opus-vendor/silk/fixed/noise_shape_analysis_FIX.c"),
        .flags = flags,
    });
    lib.root_module.addCSourceFile(.{
        .file = b.path("vendor/opus-vendor/silk/fixed/process_gains_FIX.c"),
        .flags = flags,
    });
    lib.root_module.addCSourceFile(.{
        .file = b.path("vendor/opus-vendor/silk/fixed/regularize_correlations_FIX.c"),
        .flags = flags,
    });
    lib.root_module.addCSourceFile(.{
        .file = b.path("vendor/opus-vendor/silk/fixed/residual_energy16_FIX.c"),
        .flags = flags,
    });
    lib.root_module.addCSourceFile(.{
        .file = b.path("vendor/opus-vendor/silk/fixed/residual_energy_FIX.c"),
        .flags = flags,
    });
    lib.root_module.addCSourceFile(.{
        .file = b.path("vendor/opus-vendor/silk/fixed/warped_autocorrelation_FIX.c"),
        .flags = flags,
    });
    lib.root_module.addCSourceFile(.{
        .file = b.path("vendor/opus-vendor/silk/fixed/apply_sine_window_FIX.c"),
        .flags = flags,
    });
    lib.root_module.addCSourceFile(.{
        .file = b.path("vendor/opus-vendor/silk/fixed/autocorr_FIX.c"),
        .flags = flags,
    });
    lib.root_module.addCSourceFile(.{
        .file = b.path("vendor/opus-vendor/silk/fixed/burg_modified_FIX.c"),
        .flags = flags,
    });
    lib.root_module.addCSourceFile(.{
        .file = b.path("vendor/opus-vendor/silk/fixed/k2a_FIX.c"),
        .flags = flags,
    });
    lib.root_module.addCSourceFile(.{
        .file = b.path("vendor/opus-vendor/silk/fixed/k2a_Q16_FIX.c"),
        .flags = flags,
    });
    lib.root_module.addCSourceFile(.{
        .file = b.path("vendor/opus-vendor/silk/fixed/pitch_analysis_core_FIX.c"),
        .flags = flags,
    });
    lib.root_module.addCSourceFile(.{
        .file = b.path("vendor/opus-vendor/silk/fixed/vector_ops_FIX.c"),
        .flags = flags,
    });
    lib.root_module.addCSourceFile(.{
        .file = b.path("vendor/opus-vendor/silk/fixed/schur64_FIX.c"),
        .flags = flags,
    });
    lib.root_module.addCSourceFile(.{
        .file = b.path("vendor/opus-vendor/silk/fixed/schur_FIX.c"),
        .flags = flags,
    });
    lib.root_module.addCSourceFile(.{
        .file = b.path("vendor/opus-vendor/celt/bands.c"),
        .flags = flags,
    });
    lib.root_module.addCSourceFile(.{
        .file = b.path("vendor/opus-vendor/celt/celt.c"),
        .flags = flags,
    });
    lib.root_module.addCSourceFile(.{
        .file = b.path("vendor/opus-vendor/celt/celt_encoder.c"),
        .flags = flags,
    });
    lib.root_module.addCSourceFile(.{
        .file = b.path("vendor/opus-vendor/celt/celt_decoder.c"),
        .flags = flags,
    });
    lib.root_module.addCSourceFile(.{
        .file = b.path("vendor/opus-vendor/celt/cwrs.c"),
        .flags = flags,
    });
    lib.root_module.addCSourceFile(.{
        .file = b.path("vendor/opus-vendor/celt/entcode.c"),
        .flags = flags,
    });
    lib.root_module.addCSourceFile(.{
        .file = b.path("vendor/opus-vendor/celt/entdec.c"),
        .flags = flags,
    });
    lib.root_module.addCSourceFile(.{
        .file = b.path("vendor/opus-vendor/celt/entenc.c"),
        .flags = flags,
    });
    lib.root_module.addCSourceFile(.{
        .file = b.path("vendor/opus-vendor/celt/kiss_fft.c"),
        .flags = flags,
    });
    lib.root_module.addCSourceFile(.{
        .file = b.path("vendor/opus-vendor/celt/laplace.c"),
        .flags = flags,
    });
    lib.root_module.addCSourceFile(.{
        .file = b.path("vendor/opus-vendor/celt/mathops.c"),
        .flags = flags,
    });
    lib.root_module.addCSourceFile(.{
        .file = b.path("vendor/opus-vendor/celt/mdct.c"),
        .flags = flags,
    });
    lib.root_module.addCSourceFile(.{
        .file = b.path("vendor/opus-vendor/celt/modes.c"),
        .flags = flags,
    });
    lib.root_module.addCSourceFile(.{
        .file = b.path("vendor/opus-vendor/celt/pitch.c"),
        .flags = flags,
    });
    lib.root_module.addCSourceFile(.{
        .file = b.path("vendor/opus-vendor/celt/celt_lpc.c"),
        .flags = flags,
    });
    lib.root_module.addCSourceFile(.{
        .file = b.path("vendor/opus-vendor/celt/quant_bands.c"),
        .flags = flags,
    });
    lib.root_module.addCSourceFile(.{
        .file = b.path("vendor/opus-vendor/celt/rate.c"),
        .flags = flags,
    });
    lib.root_module.addCSourceFile(.{
        .file = b.path("vendor/opus-vendor/celt/vq.c"),
        .flags = flags,
    });
    lib.root_module.addCSourceFile(.{
        .file = b.path("vendor/opus-vendor/src/opus.c"),
        .flags = flags,
    });
    lib.root_module.addCSourceFile(.{
        .file = b.path("vendor/opus-vendor/src/opus_decoder.c"),
        .flags = flags,
    });
    lib.root_module.addCSourceFile(.{
        .file = b.path("vendor/opus-vendor/src/opus_encoder.c"),
        .flags = flags,
    });
    lib.root_module.addCSourceFile(.{
        .file = b.path("vendor/opus-vendor/src/extensions.c"),
        .flags = flags,
    });
    lib.root_module.addCSourceFile(.{
        .file = b.path("vendor/opus-vendor/src/opus_multistream.c"),
        .flags = flags,
    });
    lib.root_module.addCSourceFile(.{
        .file = b.path("vendor/opus-vendor/src/opus_multistream_encoder.c"),
        .flags = flags,
    });
    lib.root_module.addCSourceFile(.{
        .file = b.path("vendor/opus-vendor/src/opus_multistream_decoder.c"),
        .flags = flags,
    });
    lib.root_module.addCSourceFile(.{
        .file = b.path("vendor/opus-vendor/src/repacketizer.c"),
        .flags = flags,
    });
    lib.root_module.addCSourceFile(.{
        .file = b.path("vendor/opus-vendor/src/opus_projection_encoder.c"),
        .flags = flags,
    });
    lib.root_module.addCSourceFile(.{
        .file = b.path("vendor/opus-vendor/src/opus_projection_decoder.c"),
        .flags = flags,
    });
    lib.root_module.addCSourceFile(.{
        .file = b.path("vendor/opus-vendor/src/mapping_matrix.c"),
        .flags = flags,
    });
    lib.root_module.addCSourceFile(.{
        .file = b.path("vendor/opus-vendor/src/analysis.c"),
        .flags = flags,
    });
    lib.root_module.addCSourceFile(.{
        .file = b.path("vendor/opus-vendor/src/mlp.c"),
        .flags = flags,
    });
    lib.root_module.addCSourceFile(.{
        .file = b.path("vendor/opus-vendor/src/mlp_data.c"),
        .flags = flags,
    });
    lib.root_module.addCSourceFile(.{
        .file = b.path("vendor/opus-vendor/silk/float/apply_sine_window_FLP.c"),
        .flags = flags,
    });
    lib.root_module.addCSourceFile(.{
        .file = b.path("vendor/opus-vendor/silk/float/corrMatrix_FLP.c"),
        .flags = flags,
    });
    lib.root_module.addCSourceFile(.{
        .file = b.path("vendor/opus-vendor/silk/float/encode_frame_FLP.c"),
        .flags = flags,
    });
    lib.root_module.addCSourceFile(.{
        .file = b.path("vendor/opus-vendor/silk/float/find_LPC_FLP.c"),
        .flags = flags,
    });
    lib.root_module.addCSourceFile(.{
        .file = b.path("vendor/opus-vendor/silk/float/find_LTP_FLP.c"),
        .flags = flags,
    });
    lib.root_module.addCSourceFile(.{
        .file = b.path("vendor/opus-vendor/silk/float/find_pitch_lags_FLP.c"),
        .flags = flags,
    });
    lib.root_module.addCSourceFile(.{
        .file = b.path("vendor/opus-vendor/silk/float/find_pred_coefs_FLP.c"),
        .flags = flags,
    });
    lib.root_module.addCSourceFile(.{
        .file = b.path("vendor/opus-vendor/silk/float/LPC_analysis_filter_FLP.c"),
        .flags = flags,
    });
    lib.root_module.addCSourceFile(.{
        .file = b.path("vendor/opus-vendor/silk/float/LTP_analysis_filter_FLP.c"),
        .flags = flags,
    });
    lib.root_module.addCSourceFile(.{
        .file = b.path("vendor/opus-vendor/silk/float/LTP_scale_ctrl_FLP.c"),
        .flags = flags,
    });
    lib.root_module.addCSourceFile(.{
        .file = b.path("vendor/opus-vendor/silk/float/noise_shape_analysis_FLP.c"),
        .flags = flags,
    });
    lib.root_module.addCSourceFile(.{
        .file = b.path("vendor/opus-vendor/silk/float/process_gains_FLP.c"),
        .flags = flags,
    });
    lib.root_module.addCSourceFile(.{
        .file = b.path("vendor/opus-vendor/silk/float/regularize_correlations_FLP.c"),
        .flags = flags,
    });
    lib.root_module.addCSourceFile(.{
        .file = b.path("vendor/opus-vendor/silk/float/residual_energy_FLP.c"),
        .flags = flags,
    });
    lib.root_module.addCSourceFile(.{
        .file = b.path("vendor/opus-vendor/silk/float/warped_autocorrelation_FLP.c"),
        .flags = flags,
    });
    lib.root_module.addCSourceFile(.{
        .file = b.path("vendor/opus-vendor/silk/float/wrappers_FLP.c"),
        .flags = flags,
    });
    lib.root_module.addCSourceFile(.{
        .file = b.path("vendor/opus-vendor/silk/float/autocorrelation_FLP.c"),
        .flags = flags,
    });
    lib.root_module.addCSourceFile(.{
        .file = b.path("vendor/opus-vendor/silk/float/burg_modified_FLP.c"),
        .flags = flags,
    });
    lib.root_module.addCSourceFile(.{
        .file = b.path("vendor/opus-vendor/silk/float/bwexpander_FLP.c"),
        .flags = flags,
    });
    lib.root_module.addCSourceFile(.{
        .file = b.path("vendor/opus-vendor/silk/float/energy_FLP.c"),
        .flags = flags,
    });
    lib.root_module.addCSourceFile(.{
        .file = b.path("vendor/opus-vendor/silk/float/inner_product_FLP.c"),
        .flags = flags,
    });
    lib.root_module.addCSourceFile(.{
        .file = b.path("vendor/opus-vendor/silk/float/k2a_FLP.c"),
        .flags = flags,
    });
    lib.root_module.addCSourceFile(.{
        .file = b.path("vendor/opus-vendor/silk/float/LPC_inv_pred_gain_FLP.c"),
        .flags = flags,
    });
    lib.root_module.addCSourceFile(.{
        .file = b.path("vendor/opus-vendor/silk/float/pitch_analysis_core_FLP.c"),
        .flags = flags,
    });
    lib.root_module.addCSourceFile(.{
        .file = b.path("vendor/opus-vendor/silk/float/scale_copy_vector_FLP.c"),
        .flags = flags,
    });
    lib.root_module.addCSourceFile(.{
        .file = b.path("vendor/opus-vendor/silk/float/scale_vector_FLP.c"),
        .flags = flags,
    });
    lib.root_module.addCSourceFile(.{
        .file = b.path("vendor/opus-vendor/silk/float/schur_FLP.c"),
        .flags = flags,
    });
    lib.root_module.addCSourceFile(.{
        .file = b.path("vendor/opus-vendor/silk/float/sort_FLP.c"),
        .flags = flags,
    });

    // Upstream include roots, mirroring its CMakeLists: public headers,
    // per-module private headers, plus the source root for os_support.h.
    lib.root_module.addIncludePath(b.path("vendor/opus-vendor/include"));
    lib.root_module.addIncludePath(b.path("vendor/opus-vendor"));
    lib.root_module.addIncludePath(b.path("vendor/opus-vendor/celt"));
    lib.root_module.addIncludePath(b.path("vendor/opus-vendor/silk"));
    lib.root_module.addIncludePath(b.path("vendor/opus-vendor/silk/float"));
    lib.root_module.addIncludePath(b.path("vendor/opus-vendor/silk/fixed"));

    // Consumers include <opus/opus.h> straight from this dir; the install
    // tree only carries the .so (same as the md4c wrapper next to it).
    const install = b.addInstallArtifact(lib, .{});

    const hash_step = build_utils.HashAndMoveStep.create(
        b,
        lib_name,
        target_str,
        artifacts_dir,
        hashes,
    );
    hash_step.step.dependOn(&install.step);

    json_step.step.dependOn(&hash_step.step);
}

pub fn build(b: *std.Build) void {
    const optimize = b.option(std.builtin.OptimizeMode, "optimize", "Prioritize performance, safety, or binary size") orelse .ReleaseFast;
    const artifacts_dir = "../../artifacts/libs";
    const json_path = "current.json";

    const build_all = b.option(bool, "all", "Build for all supported targets") orelse false;

    if (build_all) {
        const hashes = build_utils.createHashMap(b);
        const json_step = build_utils.WriteJsonStep.create(b, hashes, json_path);

        for (build_utils.supported_targets) |query| {
            const target = b.resolveTargetQuery(query);
            buildForTarget(b, target, optimize, artifacts_dir, hashes, json_step);
        }

        b.default_step.dependOn(&json_step.step);
    } else {
        const target = b.standardTargetOptions(.{});

        const lib = b.addLibrary(.{
            .name = "opus",
            .linkage = .dynamic,
            .root_module = b.createModule(.{
                .root_source_file = b.path("src/main.zig"),
                .target = target,
                .optimize = optimize,
            }),
        });

        lib.root_module.link_libc = true;

        const flags = &[_][]const u8{
            "-O2",
            "-fPIC",
            "-fvisibility=hidden",
            "-DOPUS_BUILD",
            "-DVAR_ARRAYS",
        };

        const c_files = [_][]const u8{
            "vendor/opus-vendor/silk/CNG.c",
            "vendor/opus-vendor/silk/code_signs.c",
            "vendor/opus-vendor/silk/init_decoder.c",
            "vendor/opus-vendor/silk/decode_core.c",
            "vendor/opus-vendor/silk/decode_frame.c",
            "vendor/opus-vendor/silk/decode_parameters.c",
            "vendor/opus-vendor/silk/decode_indices.c",
            "vendor/opus-vendor/silk/decode_pulses.c",
            "vendor/opus-vendor/silk/decoder_set_fs.c",
            "vendor/opus-vendor/silk/dec_API.c",
            "vendor/opus-vendor/silk/enc_API.c",
            "vendor/opus-vendor/silk/encode_indices.c",
            "vendor/opus-vendor/silk/encode_pulses.c",
            "vendor/opus-vendor/silk/gain_quant.c",
            "vendor/opus-vendor/silk/interpolate.c",
            "vendor/opus-vendor/silk/LP_variable_cutoff.c",
            "vendor/opus-vendor/silk/NLSF_decode.c",
            "vendor/opus-vendor/silk/NSQ.c",
            "vendor/opus-vendor/silk/NSQ_del_dec.c",
            "vendor/opus-vendor/silk/PLC.c",
            "vendor/opus-vendor/silk/shell_coder.c",
            "vendor/opus-vendor/silk/tables_gain.c",
            "vendor/opus-vendor/silk/tables_LTP.c",
            "vendor/opus-vendor/silk/tables_NLSF_CB_NB_MB.c",
            "vendor/opus-vendor/silk/tables_NLSF_CB_WB.c",
            "vendor/opus-vendor/silk/tables_other.c",
            "vendor/opus-vendor/silk/tables_pitch_lag.c",
            "vendor/opus-vendor/silk/tables_pulses_per_block.c",
            "vendor/opus-vendor/silk/VAD.c",
            "vendor/opus-vendor/silk/control_audio_bandwidth.c",
            "vendor/opus-vendor/silk/quant_LTP_gains.c",
            "vendor/opus-vendor/silk/VQ_WMat_EC.c",
            "vendor/opus-vendor/silk/HP_variable_cutoff.c",
            "vendor/opus-vendor/silk/NLSF_encode.c",
            "vendor/opus-vendor/silk/NLSF_VQ.c",
            "vendor/opus-vendor/silk/NLSF_unpack.c",
            "vendor/opus-vendor/silk/NLSF_del_dec_quant.c",
            "vendor/opus-vendor/silk/process_NLSFs.c",
            "vendor/opus-vendor/silk/stereo_LR_to_MS.c",
            "vendor/opus-vendor/silk/stereo_MS_to_LR.c",
            "vendor/opus-vendor/silk/check_control_input.c",
            "vendor/opus-vendor/silk/control_SNR.c",
            "vendor/opus-vendor/silk/init_encoder.c",
            "vendor/opus-vendor/silk/control_codec.c",
            "vendor/opus-vendor/silk/A2NLSF.c",
            "vendor/opus-vendor/silk/ana_filt_bank_1.c",
            "vendor/opus-vendor/silk/biquad_alt.c",
            "vendor/opus-vendor/silk/bwexpander_32.c",
            "vendor/opus-vendor/silk/bwexpander.c",
            "vendor/opus-vendor/silk/debug.c",
            "vendor/opus-vendor/silk/decode_pitch.c",
            "vendor/opus-vendor/silk/inner_prod_aligned.c",
            "vendor/opus-vendor/silk/lin2log.c",
            "vendor/opus-vendor/silk/log2lin.c",
            "vendor/opus-vendor/silk/LPC_analysis_filter.c",
            "vendor/opus-vendor/silk/LPC_inv_pred_gain.c",
            "vendor/opus-vendor/silk/table_LSF_cos.c",
            "vendor/opus-vendor/silk/NLSF2A.c",
            "vendor/opus-vendor/silk/NLSF_stabilize.c",
            "vendor/opus-vendor/silk/NLSF_VQ_weights_laroia.c",
            "vendor/opus-vendor/silk/pitch_est_tables.c",
            "vendor/opus-vendor/silk/resampler.c",
            "vendor/opus-vendor/silk/resampler_down2_3.c",
            "vendor/opus-vendor/silk/resampler_down2.c",
            "vendor/opus-vendor/silk/resampler_private_AR2.c",
            "vendor/opus-vendor/silk/resampler_private_down_FIR.c",
            "vendor/opus-vendor/silk/resampler_private_IIR_FIR.c",
            "vendor/opus-vendor/silk/resampler_private_up2_HQ.c",
            "vendor/opus-vendor/silk/resampler_rom.c",
            "vendor/opus-vendor/silk/sigm_Q15.c",
            "vendor/opus-vendor/silk/sort.c",
            "vendor/opus-vendor/silk/sum_sqr_shift.c",
            "vendor/opus-vendor/silk/stereo_decode_pred.c",
            "vendor/opus-vendor/silk/stereo_encode_pred.c",
            "vendor/opus-vendor/silk/stereo_find_predictor.c",
            "vendor/opus-vendor/silk/stereo_quant_pred.c",
            "vendor/opus-vendor/silk/LPC_fit.c",
            "vendor/opus-vendor/silk/fixed/LTP_analysis_filter_FIX.c",
            "vendor/opus-vendor/silk/fixed/LTP_scale_ctrl_FIX.c",
            "vendor/opus-vendor/silk/fixed/corrMatrix_FIX.c",
            "vendor/opus-vendor/silk/fixed/encode_frame_FIX.c",
            "vendor/opus-vendor/silk/fixed/find_LPC_FIX.c",
            "vendor/opus-vendor/silk/fixed/find_LTP_FIX.c",
            "vendor/opus-vendor/silk/fixed/find_pitch_lags_FIX.c",
            "vendor/opus-vendor/silk/fixed/find_pred_coefs_FIX.c",
            "vendor/opus-vendor/silk/fixed/noise_shape_analysis_FIX.c",
            "vendor/opus-vendor/silk/fixed/process_gains_FIX.c",
            "vendor/opus-vendor/silk/fixed/regularize_correlations_FIX.c",
            "vendor/opus-vendor/silk/fixed/residual_energy16_FIX.c",
            "vendor/opus-vendor/silk/fixed/residual_energy_FIX.c",
            "vendor/opus-vendor/silk/fixed/warped_autocorrelation_FIX.c",
            "vendor/opus-vendor/silk/fixed/apply_sine_window_FIX.c",
            "vendor/opus-vendor/silk/fixed/autocorr_FIX.c",
            "vendor/opus-vendor/silk/fixed/burg_modified_FIX.c",
            "vendor/opus-vendor/silk/fixed/k2a_FIX.c",
            "vendor/opus-vendor/silk/fixed/k2a_Q16_FIX.c",
            "vendor/opus-vendor/silk/fixed/pitch_analysis_core_FIX.c",
            "vendor/opus-vendor/silk/fixed/vector_ops_FIX.c",
            "vendor/opus-vendor/silk/fixed/schur64_FIX.c",
            "vendor/opus-vendor/silk/fixed/schur_FIX.c",
            "vendor/opus-vendor/celt/bands.c",
            "vendor/opus-vendor/celt/celt.c",
            "vendor/opus-vendor/celt/celt_encoder.c",
            "vendor/opus-vendor/celt/celt_decoder.c",
            "vendor/opus-vendor/celt/cwrs.c",
            "vendor/opus-vendor/celt/entcode.c",
            "vendor/opus-vendor/celt/entdec.c",
            "vendor/opus-vendor/celt/entenc.c",
            "vendor/opus-vendor/celt/kiss_fft.c",
            "vendor/opus-vendor/celt/laplace.c",
            "vendor/opus-vendor/celt/mathops.c",
            "vendor/opus-vendor/celt/mdct.c",
            "vendor/opus-vendor/celt/modes.c",
            "vendor/opus-vendor/celt/pitch.c",
            "vendor/opus-vendor/celt/celt_lpc.c",
            "vendor/opus-vendor/celt/quant_bands.c",
            "vendor/opus-vendor/celt/rate.c",
            "vendor/opus-vendor/celt/vq.c",
            "vendor/opus-vendor/src/opus.c",
            "vendor/opus-vendor/src/opus_decoder.c",
            "vendor/opus-vendor/src/opus_encoder.c",
            "vendor/opus-vendor/src/extensions.c",
            "vendor/opus-vendor/src/opus_multistream.c",
            "vendor/opus-vendor/src/opus_multistream_encoder.c",
            "vendor/opus-vendor/src/opus_multistream_decoder.c",
            "vendor/opus-vendor/src/repacketizer.c",
            "vendor/opus-vendor/src/opus_projection_encoder.c",
            "vendor/opus-vendor/src/opus_projection_decoder.c",
            "vendor/opus-vendor/src/mapping_matrix.c",
            "vendor/opus-vendor/src/analysis.c",
            "vendor/opus-vendor/src/mlp.c",
            "vendor/opus-vendor/src/mlp_data.c",
            "vendor/opus-vendor/silk/float/apply_sine_window_FLP.c",
            "vendor/opus-vendor/silk/float/corrMatrix_FLP.c",
            "vendor/opus-vendor/silk/float/encode_frame_FLP.c",
            "vendor/opus-vendor/silk/float/find_LPC_FLP.c",
            "vendor/opus-vendor/silk/float/find_LTP_FLP.c",
            "vendor/opus-vendor/silk/float/find_pitch_lags_FLP.c",
            "vendor/opus-vendor/silk/float/find_pred_coefs_FLP.c",
            "vendor/opus-vendor/silk/float/LPC_analysis_filter_FLP.c",
            "vendor/opus-vendor/silk/float/LTP_analysis_filter_FLP.c",
            "vendor/opus-vendor/silk/float/LTP_scale_ctrl_FLP.c",
            "vendor/opus-vendor/silk/float/noise_shape_analysis_FLP.c",
            "vendor/opus-vendor/silk/float/process_gains_FLP.c",
            "vendor/opus-vendor/silk/float/regularize_correlations_FLP.c",
            "vendor/opus-vendor/silk/float/residual_energy_FLP.c",
            "vendor/opus-vendor/silk/float/warped_autocorrelation_FLP.c",
            "vendor/opus-vendor/silk/float/wrappers_FLP.c",
            "vendor/opus-vendor/silk/float/autocorrelation_FLP.c",
            "vendor/opus-vendor/silk/float/burg_modified_FLP.c",
            "vendor/opus-vendor/silk/float/bwexpander_FLP.c",
            "vendor/opus-vendor/silk/float/energy_FLP.c",
            "vendor/opus-vendor/silk/float/inner_product_FLP.c",
            "vendor/opus-vendor/silk/float/k2a_FLP.c",
            "vendor/opus-vendor/silk/float/LPC_inv_pred_gain_FLP.c",
            "vendor/opus-vendor/silk/float/pitch_analysis_core_FLP.c",
            "vendor/opus-vendor/silk/float/scale_copy_vector_FLP.c",
            "vendor/opus-vendor/silk/float/scale_vector_FLP.c",
            "vendor/opus-vendor/silk/float/schur_FLP.c",
            "vendor/opus-vendor/silk/float/sort_FLP.c",
        };

        for (c_files) |file| {
            lib.root_module.addCSourceFile(.{
                .file = b.path(file),
                .flags = flags,
            });
        }

        lib.root_module.addIncludePath(b.path("vendor/opus-vendor/include"));
        lib.root_module.addIncludePath(b.path("vendor/opus-vendor"));
        lib.root_module.addIncludePath(b.path("vendor/opus-vendor/celt"));
        lib.root_module.addIncludePath(b.path("vendor/opus-vendor/silk"));
        lib.root_module.addIncludePath(b.path("vendor/opus-vendor/silk/float"));
        lib.root_module.addIncludePath(b.path("vendor/opus-vendor/silk/fixed"));

        b.installArtifact(lib);
    }
}
